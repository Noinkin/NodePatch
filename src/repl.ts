#!/usr/bin/env node
import repl from "repl";
import path from "path";
import { patchModules } from "./core/patchModules.js";

// ------------------------------
// Start live REPL
// ------------------------------
export function startRepl() {
  const replServer = repl.start({
    prompt: "NodePatch> ",
    useGlobal: true,
    ignoreUndefined: true
  });

  // Expose patchModules and helpers
  replServer.context.patchModules = patchModules;
  replServer.context.reload = (name: string) => {
    const entry: any = patchModules.get(name);
    if (!entry.constructor) throw new Error(`Cannot reload ${name}: no constructor`);
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

  console.log("NodePatch REPL started! Type .help for commands.");
}
