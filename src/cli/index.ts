#!/usr/bin/env node
import path from "path";
import { applyPatch, applyPatchDir } from "../core/patchLoader.js";
import { rollback, rollbackDir } from "../core/rollbackManager.js";
import { patchModules } from "../core/patchModules.js";
import { Logger } from "../utils/logger";

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log("Usage:");
    console.log("  nodepatch apply <file> <patch>");
    console.log("  nodepatch apply-dir <dir> <patchDir> [recursive]");
    console.log("  nodepatch rollback <file>");
    console.log("  nodepatch rollback-dir <dir> [recursive]");
    console.log("  nodepatch register-module <name> <file>");
    console.log("  nodepatch reload-module <name>");
    console.log("  nodepatch rollback-module <name>");
    process.exit(1);
}

const [command, arg1, arg2, recursiveFlag] = args;
const recursive = recursiveFlag === "true";

switch (command) {
    case "apply":
        applyPatch(path.resolve(arg1), path.resolve(arg2));
        break;

    case "apply-dir":
        applyPatchDir(path.resolve(arg1), path.resolve(arg2), recursive);
        break;

    case "rollback":
        rollback(path.resolve(arg1));
        break;

    case "rollback-dir":
        rollbackDir(path.resolve(arg1), recursive);
        break;

    case "register-module":
        patchModules.register(arg1, arg2);
        Logger.log(`Module registered: ${arg1}`);
        break;

    case "reload-module":
        patchModules.reload(arg1);
        break;

    case "rollback-module":
        patchModules.rollback(arg1);
        break;

    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
}
