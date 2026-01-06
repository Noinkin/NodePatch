#!/usr/bin/env node
import repl from "node:repl";
import path from "node:path";
import util from "node:util";
import { exec } from "node:child_process";
import { patchModules } from "./core/patchModules.js";
import { config, configSchema, saveConfig } from "./utils/config.js";
import { patchPackages } from "./core/patchPackages.js";

const execPromise = util.promisify(exec);

interface Definition {
    identifier: string;
    value: any;
}

/**
 * Start the interactive NodePatch REPL.
 * Updates modules at run-time with user input.
 */
export function startRepl(definitions: Definition[]) {
    const replServer = repl.start({
        prompt: "NodePatch> ",
        useGlobal: true,
        ignoreUndefined: true,
    });

    for (const definition of definitions) {
        if (definition.identifier && definition.value) {
            if (definition.identifier === "patchModules")
                throw new Error(
                    `Restricted Identifier ${definition.identifier}.`,
                );
            replServer.context[definition.identifier] = definition.value;
        }
    }

    // === BASIC HELPERS ===
    replServer.context.patchModules = patchModules;

    replServer.defineCommand("register", {
        help: "[NodePatch/PatchModules] Register a module from a file (.register <filePath> <moduleName>)",
        async action(input) {
            const [filePath, moduleName] = input.trim().split(/\s+/);
            if (!filePath || !moduleName) {
                console.log("Usage: .register <filePath> <moduleName>");
                return this.displayPrompt();
            }

            try {
                const resolvedPath = path.resolve(process.cwd(), filePath);
                await patchModules.registerFromFile(moduleName, resolvedPath);
                console.log(
                    `✅ Registered module '${moduleName}' from '${filePath}'`,
                );
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }

            this.displayPrompt();
        },
    });

    replServer.defineCommand("forward", {
        help: "[NodePatch/PatchModules] Roll forward a module (.forward <moduleName>)",
        action(name) {
            if (!name) {
                console.log("Usage: .forward <moduleName>");
                return this.displayPrompt();
            }

            try {
                patchModules.rollForward(name.trim());
                console.log(`⏩ Rolled forward module '${name.trim()}'`);
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }

            this.displayPrompt();
        },
    });

    replServer.defineCommand("history", {
        help: "[NodePatch/PatchModules] Show rollback/forward history for a module (.history <moduleName>)",
        action(name) {
            if (!name) {
                console.log("Usage: .history <moduleName>");
                return this.displayPrompt();
            }

            try {
                const moduleName = name.trim();
                const info = patchModules.getHistory(moduleName);

                console.log(
                    `📜 Module '${moduleName}': ` +
                        `rollback=${info.past}, ` +
                        `forward=${info.future}`,
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
        async action(name) {
            if (!name) {
                console.log("Usage: .reload <moduleName>");
                return this.displayPrompt();
            }
            try {
                await patchModules.reload(name.trim());
                console.log(`✅ Reloaded module '${name.trim()}'`);
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
                const resolvedPath = path.resolve(process.cwd(), filePath);
                await patchModules.reloadFromFile(moduleName, resolvedPath);
            } catch (err: any) {
                console.error(`❌ ${err.message}`);
            }

            this.displayPrompt();
        },
    });

    replServer.defineCommand("rollback", {
        help: "[NodePatch/PatchModules] Roll back a module to the previous version (.rollback <moduleName>)",
        action(name) {
            if (!name) {
                console.log("Usage: .rollback <moduleName>");
                return this.displayPrompt();
            }

            try {
                patchModules.rollback(name.trim());
                console.log(`⏪ Rolled back module '${name.trim()}'`);
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
