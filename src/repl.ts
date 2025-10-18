#!/usr/bin/env node
import repl from "repl";
import path from "path";
import { pathToFileURL } from "url";
import { patchModules } from "./core/patchModules.js";

export function startRepl() {
    const replServer = repl.start({
        prompt: "NodePatch> ",
        useGlobal: true,
        ignoreUndefined: true,
    });

    // Expose patchModules and helpers
    replServer.context.patchModules = patchModules;
    replServer.context.reload = (name: string) => {
        const entry: any = patchModules.get(name);
        if (!entry.constructor)
            throw new Error(`Cannot reload ${name}: no constructor`);
        patchModules.reloadInstance(name, new entry.constructor());
        console.log(`✅ Reloaded module: ${name}`);
    };
    replServer.context.rollback = (name: string) => {
        patchModules.rollback(name);
        console.log(`✅ Rolled back module: ${name}`);
    };
    replServer.context.reloadFromFile = (name: string, filePath: string) => {
        const resolvedPath = path.resolve(filePath);
        delete require.cache[require.resolve(resolvedPath)];
        const newModule = require(resolvedPath);
        patchModules.reloadInstance(name, newModule);
        console.log(`✅ Reloaded module '${name}' from file '${filePath}'`);
    };
    replServer.context.load = (filePath: string, moduleName: string) => {
        const resolvedPath = path.resolve(filePath);
        delete require.cache[require.resolve(resolvedPath)];
        const moduleInstance = require(resolvedPath);
        patchModules.register(moduleName, moduleInstance);
        console.log(`✅ Loaded module '${moduleName}' from file '${filePath}'`);
    };

    // Add custom commands
    replServer.defineCommand("modules", {
        help: "[NodePatch] List all registered modules",
        action() {
            const list = patchModules.list();
            console.log(list.length ? list.join(", ") : "(none)");
            this.displayPrompt();
        },
    });

    replServer.defineCommand("reload", {
        help: "[NodePatch] Reload a registered module",
        action(name) {
            if (!name) {
                console.log("Usage: .reload <moduleName>");
                return this.displayPrompt();
            }
            try {
                patchModules.reload(name.trim());
                console.log(`✅ Reloaded module '${name.trim()}'`);
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }
            this.displayPrompt();
        },
    });

    replServer.defineCommand("rollback", {
        help: "[NodePatch] Rollback a module to its previous version",
        action(name) {
            if (!name) {
                console.log("Usage: .rollback <moduleName>");
                return this.displayPrompt();
            }
            try {
                patchModules.rollback(name.trim());
                console.log(`🔁 Rolled back module '${name.trim()}'`);
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }
            this.displayPrompt();
        },
    });

    replServer.defineCommand("reloadFromFile", {
        help: "[NodePatch] Hot-patch a module from a file (.reloadFromFile <filePath> <moduleName>)",
        async action(input) {
            const [filePath, moduleName] = input.trim().split(/\s+/);
            if (!filePath || !moduleName) {
                console.log("Usage: .patch <filePath> <moduleName>");
                return this.displayPrompt();
            }

            try {
                const fullPath = path.resolve(process.cwd(), filePath);
                const { default: NewModule } = await import(
                    pathToFileURL(fullPath).href
                );
                patchModules.reloadInstance(moduleName, new NewModule());
                console.log(
                    `⚡ Hot-patched '${moduleName}' from '${filePath}'`,
                );
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }

            this.displayPrompt();
        },
    });

    // Remove excess default REPL commands
    delete (replServer.commands as any).save;
    delete (replServer.commands as any).load;

    // Update other default REPL commands description
    (replServer.commands as any).break.help =
        "[Node] Terminate current command input";
    (replServer.commands as any).clear.help =
        "[Node] Break and clear the local context";
    (replServer.commands as any).editor.help = "[Node] Enter editor mode";
    (replServer.commands as any).exit.help = "[Node] Exit the REPL";
    (replServer.commands as any).help.help = "[Node] Show help";

    console.log("NodePatch REPL started! Type .help for commands.");
}
