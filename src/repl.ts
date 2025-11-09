#!/usr/bin/env node
import repl from "repl";
import path from "path";
import util from "util";
import { exec } from "child_process";
import { pathToFileURL } from "url";
import { patchModules } from "./core/patchModules.js";
import { config, configSchema, saveConfig } from "./utils/config.js";
import { patchPackages } from "./core/patchPackages.js";

const execPromise = util.promisify(exec);

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
        help: "[NodePatch/PatchModules] List all registered modules",
        action() {
            const list = patchModules.list();
            console.log(list.length ? list.join(", ") : "(none)");
            this.displayPrompt();
        },
    });

    replServer.defineCommand("reload", {
        help: "[NodePatch/PatchModules] Reload a registered module",
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
        help: "[NodePatch/PatchModules] Rollback a module to its previous version",
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
        help: "[NodePatch/PatchModules] Hot-patch a module from a file (.reloadFromFile <filePath> <moduleName>)",
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

    // === PATCH PACKAGES COMMANDS ===
    replServer.defineCommand("npminstall", {
        help: "[NodePatch/PatchPackages] Installs an npm package at runtime: .npminstall <pkg> <version>",
        async action(input) {
            const split = input.split(" ");
            const pkg = split[0];
            let installString: string;
            if (split[1]) {
                const version = split[1];
                installString = `${pkg}@${version}`;
            } else installString = pkg;

            console.log(`Installing ${installString}...`);
            const { stdout, stderr } = await execPromise(
                `npm install ${installString} --no-audit --no-fund`,
            );
            if (stderr) console.log(stderr);
            patchPackages.get(pkg);
            console.log(stdout);
            this.displayPrompt();
        },
    });

    replServer.defineCommand("npmupdate", {
        help: "[NodePatch/PatchPackages] Updates an npm package at runtime: .npmupdate <pkg> <version>",
        async action(input) {
            const split = input.split(" ");
            const pkg = split[0];
            let installString: string;
            if (split[1]) {
                const version = split[1];
                installString = `${pkg}@${version}`;
            } else installString = pkg;

            console.log(`Updating ${installString}...`);
            const { stdout, stderr } = await execPromise(
                `npm update ${installString} --no-audit --no-fund`,
            );
            if (stderr) console.log(stderr);
            patchPackages.reload(pkg);
            console.log(stdout);
            this.displayPrompt();
        },
    });

    // === CONFIG COMMANDS ===
    replServer.defineCommand("viewconfig", {
        help: "[NodePatch/Config] View the current configuration",
        action() {
            console.log(config);
            this.displayPrompt();
        },
    });

    replServer.defineCommand("setconfig", {
        help: "[NodePatch/Config] Set a configuration property: .setconfig <key> <value>",
        action(input) {
            const [key, ...valueParts] = input.split(" ");
            let value: any = valueParts.join(" ");
            if (!configSchema[key]) throw new Error(`${key} does not exist.`);
            const type = configSchema[key];
            if (!key || !value) {
                console.log("Usage: .setconfig <key> <value>");
                return this.displayPrompt();
            }
            switch (type) {
                case "number":
                    value = Number(value);
                    if (isNaN(value))
                        throw new Error(`${value} must be a number`);
                    break;
                case "boolean":
                    if (value === "true" || value) value = true;
                    else if (value === "false" || !value) value = false;
                    else throw new Error(`${value} must be a boolean`);
                    break;
                case "string":
                    break;
            }
            const newConfig = { ...config, [key]: value };
            saveConfig(newConfig);
            console.log(`✅ Updated '${key}' to '${value}'`);
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
