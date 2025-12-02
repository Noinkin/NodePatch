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

/**
 * Start the interactive NodePatch REPL.
 * Updates modules at run-time with user input.
 */
export function startRepl() {
    const replServer = repl.start({
        prompt: "NodePatch> ",
        useGlobal: true,
        ignoreUndefined: true,
    });

    // === BASIC HELPERS ===
    replServer.context.patchModules = patchModules;

    replServer.context.reload = (name: string) => {
        const entry: any = patchModules.get(name);
        if (!entry.constructor)
            throw new Error(`Cannot reload ${name}: no constructor`);
        patchModules.reloadInstance(name, new entry.constructor());
        console.log(`✅ Reloaded module: ${name}`);
    };

    replServer.context.rollback = (name: string, steps?: number) => {
        patchModules.rollback(name, steps || 1);
        console.log(`🔁 Rolled back module '${name}'`);
    };

    replServer.context.reloadFromFile = (name: string, filePath: string) => {
        const resolvedPath = path.resolve(filePath);
        delete require.cache[require.resolve(resolvedPath)];
        const newModule = require(resolvedPath);
        patchModules.reloadInstance(name, newModule);
        console.log(`✅ Reloaded module '${name}' from file '${filePath}'`);
    };

    replServer.defineCommand("register", {
        help: "[NodePatch/PatchModules] Register a module from a file (.register <filePath> <moduleName>)",
        action(input) {
            const [filePath, moduleName] = input.trim().split(/\s+/);
            if (!filePath || !moduleName) {
                console.log("Usage: .register <filePath> <moduleName>");
                return this.displayPrompt();
            }
            try {
                const resolvedPath = path.resolve(process.cwd(), filePath);
                delete require.cache[require.resolve(resolvedPath)];
                const moduleInstance = require(resolvedPath);
                patchModules.registerFromFile(moduleName, resolvedPath);
                console.log(
                    `✅ Registered module '${moduleName}' from file '${filePath}'`,
                );
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }
            this.displayPrompt();
        },
    });

    // === PATCH MODULES COMMANDS ===
    replServer.defineCommand("modules", {
        help: "[NodePatch/PatchModules] List all registered modules",
        action() {
            const list = patchModules.list();
            console.log(list.length ? list.join(", ") : "(none)");
            this.displayPrompt();
        },
    });

    replServer.defineCommand("reload", {
        help: "[NodePatch/PatchModules] Reload a registered module (.reload <moduleName>)",
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
        help: "[NodePatch/PatchModules] Roll back a module (.rollback <moduleName> [steps])",
        action(input) {
            const [name, stepsRaw] = input.trim().split(/\s+/);
            if (!name) {
                console.log("Usage: .rollback <moduleName> [steps]");
                return this.displayPrompt();
            }
            const steps = stepsRaw ? Number(stepsRaw) : 1;
            if (Number.isNaN(steps) || steps < 1) {
                console.log("Steps must be a positive integer.");
                return this.displayPrompt();
            }

            try {
                patchModules.rollback(name.trim(), steps);
                console.log(
                    `🔁 Rolled back module '${name.trim()}' by ${steps} version(s)`,
                );
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }
            this.displayPrompt();
        },
    });

    replServer.defineCommand("history", {
        help: "[NodePatch/PatchModules] Show stored version history for a module (.history <moduleName>)",
        action(name) {
            if (!name) {
                console.log("Usage: .history <moduleName>");
                return this.displayPrompt();
            }

            try {
                const history = patchModules.history(name.trim());
                if (!history.length) {
                    console.log("(no stored versions)");
                } else {
                    console.log(`Version history for '${name.trim()}':`);
                    history.forEach((v, i) => {
                        console.log(
                            `${i}: ${v.key} (${new Date(
                                v.createdAt,
                            ).toLocaleString()})`,
                        );
                    });
                }
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
                console.log("Usage: .reloadFromFile <filePath> <moduleName>");
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
        help: "[NodePatch/PatchPackages] Install an npm package at runtime: .npminstall <pkg> [version]",
        async action(input) {
            const split = input.split(" ");
            const pkg = split[0];
            let installString = pkg;
            if (split[1]) installString += `@${split[1]}`;

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
        help: "[NodePatch/PatchPackages] Update an npm package: .npmupdate <pkg> [version]",
        async action(input) {
            const split = input.split(" ");
            const pkg = split[0];
            let installString = pkg;
            if (split[1]) installString += `@${split[1]}`;

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
        help: "[NodePatch/Config] Set a configuration property (.setconfig <key> <value>)",
        action(input) {
            const [key, ...valueParts] = input.split(" ");
            let value: any = valueParts.join(" ");
            if (!key || !value) {
                console.log("Usage: .setconfig <key> <value>");
                return this.displayPrompt();
            }
            if (!configSchema[key]) {
                console.error(`❌ ${key} is not a valid configuration key`);
                return this.displayPrompt();
            }

            const type = configSchema[key];
            switch (type) {
                case "number":
                    value = Number(value);
                    if (isNaN(value))
                        throw new Error(`${value} must be a number`);
                    break;
                case "boolean":
                    if (value === "true" || value === "1") value = true;
                    else if (value === "false" || value === "0") value = false;
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

    // === CLEAN UP DEFAULT REPL COMMANDS ===
    delete (replServer.commands as any).save;
    delete (replServer.commands as any).load;

    (replServer.commands as any).break.help = "[Node] Terminate current input";
    (replServer.commands as any).clear.help = "[Node] Clear the REPL context";
    (replServer.commands as any).editor.help = "[Node] Enter editor mode";
    (replServer.commands as any).exit.help = "[Node] Exit the REPL";
    (replServer.commands as any).help.help = "[Node] Show all REPL commands";

    console.log("NodePatch REPL started! Type .help for commands.");
}
