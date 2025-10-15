import { getRollbackRegistry } from "./patchLoader.js";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";

export function rollback(modulePath: string) {
  const resolved = require.resolve(modulePath);
  const registry = getRollbackRegistry();
  const cachedModule = require.cache[resolved];

  if (!cachedModule) {
    throw Logger.error(`Module not in cache: ${modulePath}`);
  }

  if (!registry[resolved]) {
    throw Logger.error(`No patch to rollback for ${modulePath}`);
  }

  cachedModule.exports = registry[resolved].old;
  delete registry[resolved];

  Logger.log(`Rollback successful: ${modulePath}`);
}

export function rollbackDir(dirPath: string, recursive = false) {
  const registry = getRollbackRegistry();
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const resolvedPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) rollbackDir(resolvedPath, true);
    } else if (entry.isFile()) {
      if (registry[require.resolve(resolvedPath)]) {
        rollback(resolvedPath);
      }
    }
  }
}
