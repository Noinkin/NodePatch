import { Logger } from "../utils/logger.js";

type ModuleEntry = {
  path?: string;       // optional, only if registered from file
  instance: any;       // current module instance
  backup?: any;        // previous instance for rollback
};

export class PatchModules {
  private modules: Record<string, ModuleEntry> = {};

  /**
   * Register a module instance in code
   * @param name Unique module name
   * @param instance Module instance (object or class instance)
   */
  register(name: string, instance: any): any {
    this.modules[name] = { instance };
    Logger.log(`Registered module: ${name}`);
    return instance;
  }

  /**
   * Register a module from a file path (optional)
   * @param name Unique module name
   * @param modulePath Path to JS/TS module
   */
  registerFromFile(name: string, modulePath: string): any {
    const instance = require(modulePath);
    this.modules[name] = { instance, path: modulePath };
    Logger.log(`Registered module from file: ${name}`);
    return instance;
  }

  /**
   * Get a registered module instance
   */
  get<T = any>(name: string): T {
    const entry = this.modules[name];
    if (!entry) throw Logger.error(`Module not registered: ${name}`);
    return entry.instance as T;
  }

  /**
   * Reload a module from its file path (if registered with a path)
   */
  reload(name: string): any {
    const entry = this.modules[name];
    if (!entry) throw Logger.error(`Module not registered: ${name}`);
    if (!entry.path) throw Logger.error(`No file path to reload module: ${name}`);

    entry.backup = entry.instance;
    delete require.cache[require.resolve(entry.path)];
    entry.instance = require(entry.path);
    Logger.log(`Reloaded module from file: ${name}`);
    return entry.instance;
  }

  /**
   * Reload a module with a new in-memory instance
   * Useful for testing or manual hot-update without a file
   */
  reloadInstance(name: string, newInstance: any): any {
    const entry = this.modules[name];
    if (!entry) throw Logger.error(`Module not registered: ${name}`);

    entry.backup = entry.instance;
    entry.instance = newInstance;
    Logger.majorLog(`Reloaded module with new instance: ${name}`);
    return entry.instance;
  }

  /**
   * Rollback a module to previous version
   */
  rollback(name: string): any {
    const entry = this.modules[name];
    if (!entry) throw Logger.error(`Module not registered: ${name}`);
    if (!entry.backup) throw Logger.error(`No backup found for module: ${name}`);

    entry.instance = entry.backup;
    entry.backup = undefined;
    Logger.majorLog(`Rolled back module: ${name}`);
    return entry.instance;
  }

  /**
   * List all registered modules
   */
  list(): string[] {
    return Object.keys(this.modules);
  }
}

export const patchModules = new PatchModules();
