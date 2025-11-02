export class PatchPackages {
    private packages: Record<string, any> = {};

    /**
     * Get a registered module instance
     */
    get<T = any>(name: string): T {
        if (!this.packages[name]) {
            this.packages[name] = require(name);
        }
        return this.packages[name] as T;
    }

    /**
     * Reload a module from its file path (if registered with a path)
     */
    reload<T = any>(name: string): any {
        const resolvedPath = require.resolve(name);
        this.clearCache(resolvedPath);
        this.get(name);
        return this.get(name) as T;
    }

    reloadAll() {
        Object.keys(this.packages).forEach((name) => this.reload(name));
    }

    clearCache(modulePath: string) {
        const mod = require.cache[modulePath];
        if (mod) {
            for (const child of mod.children) {
                this.clearCache(child.id);
            }
            delete require.cache[modulePath];
        }
    }
}

export const patchPackages = new PatchPackages();
