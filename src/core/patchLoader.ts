import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";

type RollbackEntry = { old: any };
const rollbackRegistry: Record<string, RollbackEntry> = {};

/**
 * Apply patch to a single file
 */
export function applyPatch(modulePath: string, patchPath: string) {
  const resolvedModule = path.resolve(modulePath);
  const resolvedPatch = path.resolve(patchPath);

  if (!fs.existsSync(resolvedModule)) throw Logger.error(`Module not found: ${modulePath}`);
  if (!fs.existsSync(resolvedPatch)) throw Logger.error(`Patch not found: ${patchPath}`);

  if (!require.cache[require.resolve(resolvedModule)]) require(resolvedModule);
  const cachedModule = require.cache[require.resolve(resolvedModule)];
  if (!cachedModule) throw Logger.error(`Failed to load module: ${modulePath}`);

  // Backup for rollback
  rollbackRegistry[resolvedModule] = { old: cachedModule.exports };

  delete require.cache[require.resolve(resolvedModule)];
  const patchModule = require(resolvedPatch);
  require.cache[require.resolve(resolvedModule)]!.exports = patchModule;

  Logger.log(`Patch applied: ${modulePath}`);
  return patchModule;
}

/**
 * Apply patch to a directory
 * @param recursive - include subfolders
 */
export function applyPatchDir(dirPath: string, patchDir: string, recursive = false) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const moduleFile = path.join(dirPath, entry.name);
    const patchFile = path.join(patchDir, entry.name);

    if (entry.isDirectory()) {
      if (recursive && fs.existsSync(patchFile) && fs.statSync(patchFile).isDirectory()) {
        applyPatchDir(moduleFile, patchFile, true);
      }
    } else if (entry.isFile()) {
      if (fs.existsSync(patchFile) && fs.statSync(patchFile).isFile()) {
        applyPatch(moduleFile, patchFile);
      } else {
        Logger.warn(`Patch not found for: ${moduleFile}`);
      }
    }
  }
}

export function getRollbackRegistry() {
  return rollbackRegistry;
}
