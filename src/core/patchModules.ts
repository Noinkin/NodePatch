import { Logger } from "../utils/logger.js";
import { config } from "../utils/config.js";
import { pathToFileURL } from "url";
import path from "path";

type ModuleEntry = {
    path?: string;
    current: any;
    history: any[]; // past
    future: any[]; // redo / forward
    proxy: any;
};

export class PatchModules {
    private modules: Record<string, ModuleEntry> = {};

    private pushHistory(entry: ModuleEntry) {
        entry.history.push(entry.current);

        const max = config["max_rollback_cache"] ?? 1;
        if (entry.history.length > max) {
            entry.history.shift();
        }

        // IMPORTANT: new patch invalidates roll-forward history
        entry.future.length = 0;
    }

    register(name: string, instance: any) {
        const entry: ModuleEntry = {
            current: instance,
            history: [],
            future: [],
            proxy: this.createProxy(() => entry.current),
        };

        this.modules[name] = entry;
        Logger.log(`Registered module: ${name}`);
        return entry.proxy;
    }

    async registerFromFile(name: string, modulePath: string) {
        const impl = await this.load(modulePath);

        const entry: ModuleEntry = {
            path: modulePath,
            current: impl,
            history: [],
            future: [],
            proxy: this.createProxy(() => entry.current),
        };

        this.modules[name] = entry;
        Logger.log(`Registered module from file: ${name}`);
        return entry.proxy;
    }

    get<T = any>(name: string): T {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        return entry.proxy as T;
    }

    async reload(name: string) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        if (!entry.path)
            throw Logger.error(`No file path to reload module: ${name}`);

        Logger.log(`Attempting hot patch for module: ${name}`);

        const candidate = await this.load(entry.path);

        if (typeof candidate !== typeof entry.current) {
            throw Logger.error(
                `Patch rejected for ${name}: incompatible export type`,
            );
        }

        this.pushHistory(entry);
        entry.current = candidate;

        Logger.majorLog(
            `Hot patched module: ${name} (rollback depth=${entry.history.length})`,
        );
    }

    reloadInstance(name: string, newInstance: any) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);

        this.pushHistory(entry);
        entry.current = newInstance;

        Logger.majorLog(
            `Reloaded module with new instance: ${name} (rollback depth=${entry.history.length})`,
        );
    }

    async reloadFromFile(name: string, modulePath: string) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);

        const candidate = await this.load(modulePath);

        this.pushHistory(entry);
        entry.path = modulePath;
        entry.current = candidate;

        Logger.majorLog(`Hot patched ${name} from ${modulePath}`);
    }

    rollback(name: string) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        if (!entry.history.length)
            throw Logger.error(
                `No rollback versions available for module: ${name}`,
            );

        entry.future.push(entry.current);
        entry.current = entry.history.pop();

        Logger.majorLog(
            `Rolled back module: ${name} (past=${entry.history.length}, future=${entry.future.length})`,
        );
    }

    getHistory(name: string) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);

        return {
            past: entry.history.length,
            future: entry.future.length,
            current: entry.current,
        };
    }

    rollForward(name: string) {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        if (!entry.future.length)
            throw Logger.error(
                `No forward versions available for module: ${name}`,
            );

        entry.history.push(entry.current);
        entry.current = entry.future.pop();

        Logger.majorLog(
            `Rolled forward module: ${name} (past=${entry.history.length}, future=${entry.future.length})`,
        );
    }

    list(): string[] {
        return Object.keys(this.modules);
    }

    private async load(modulePath: string) {
        if (!path.isAbsolute(modulePath)) {
            modulePath = path.resolve(process.cwd(), modulePath);
        }

        const fileUrl = pathToFileURL(modulePath).href;

        const mod = await import(`${fileUrl}?v=${Date.now()}`);

        const impl = mod.default ?? mod;
        if (!impl) {
            throw Logger.error(`Failed to load module: ${modulePath}`);
        }

        return impl;
    }

    private createProxy(getCurrent: () => any) {
        return new Proxy(
            {},
            {
                get(_, prop) {
                    const target = getCurrent();
                    const value = Reflect.get(target, prop);
                    // Bind methods to maintain correct 'this' context
                    return typeof value === "function"
                        ? value.bind(target)
                        : value;
                },
                set(_, prop, value) {
                    const target = getCurrent();
                    return Reflect.set(target, prop, value);
                },
                apply(_, thisArg, args) {
                    const fn = getCurrent();
                    return Reflect.apply(fn, thisArg, args);
                },
                construct(_, args) {
                    const Constructor = getCurrent();
                    return Reflect.construct(Constructor, args);
                },
            },
        );
    }
}

export const patchModules = new PatchModules();
