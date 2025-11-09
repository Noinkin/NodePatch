import fs from "fs";
import { Logger } from "../utils/logger.js";
import { CodeVault } from "../utils/caching.js";

type ModuleVersionMeta = {
    key: string; // CodeVault key identifier
    createdAt: number; // Unix timestamp
};

type ModuleEntry = {
    path?: string; // optional file path for file-based modules
    instance: any; // active module instance
    backup?: any; // one-step in-memory rollback
    versions: ModuleVersionMeta[]; // version history
    currentVersion?: string; // current version key
};

/**
 * PatchModules — dynamic module registry and hot-swap manager.
 *
 * - Tracks all registered modules.
 * - Supports in-memory reloads and file reloads.
 * - Integrates with CodeVault to store compressed historical versions.
 * - Allows rollback to any previously stored version.
 */
export class PatchModules {
    private modules: Record<string, ModuleEntry> = {};
    private vault = new CodeVault({ backend: "sqlite" });

    /** Generate a version key with module name and timestamp. */
    private makeVersionKey(name: string): string {
        return `${name}@${Date.now()}`;
    }

    /**
     * Register a module instance created in memory (no file tracking).
     */
    register(name: string, instance: any): any {
        this.modules[name] = {
            instance,
            versions: [],
        };
        Logger.log(`Registered module: ${name}`);
        return instance;
    }

    /**
     * Register a module from a file path (enables multi-version rollback).
     */
    registerFromFile(name: string, modulePath: string): any {
        const instance = require(modulePath);
        const code = fs.readFileSync(modulePath, "utf-8");
        const key = this.makeVersionKey(name);
        this.vault.store(key, code);

        this.modules[name] = {
            instance,
            path: modulePath,
            versions: [{ key, createdAt: Date.now() }],
            currentVersion: key,
        };

        Logger.log(`Registered module from file: ${name}`);
        return instance;
    }

    /**
     * Retrieve a registered module instance by name.
     */
    get<T = any>(name: string): T {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        return entry.instance as T;
    }

    /**
     * Reload a file-backed module and store a new compressed version in CodeVault.
     */
    reload(name: string): any {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        if (!entry.path)
            throw Logger.error(`No file path to reload module: ${name}`);

        const code = fs.readFileSync(entry.path, "utf-8");
        const key = this.makeVersionKey(name);
        this.vault.store(key, code);

        if (!entry.versions) entry.versions = [];
        entry.versions.push({ key, createdAt: Date.now() });
        entry.currentVersion = key;

        entry.backup = entry.instance;
        delete require.cache[require.resolve(entry.path)];
        entry.instance = require(entry.path);

        Logger.log(`Reloaded module from file: ${name}`);
        return entry.instance;
    }

    /**
     * Reload a module with a new in-memory instance.
     * Optionally stores the provided source code into CodeVault for rollback.
     */
    reloadInstance(name: string, newInstance: any, sourceCode?: string): any {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);

        // If this module has a file path and code provided, store new version.
        if (entry.path && sourceCode !== undefined) {
            const key = this.makeVersionKey(name);
            this.vault.store(key, sourceCode);

            if (!entry.versions) entry.versions = [];
            entry.versions.push({ key, createdAt: Date.now() });
            entry.currentVersion = key;

            fs.writeFileSync(entry.path, sourceCode, "utf-8");
        }

        entry.backup = entry.instance;
        entry.instance = newInstance;
        Logger.majorLog(`Reloaded module with new instance: ${name}`);
        return entry.instance;
    }

    /**
     * Rollback a module to a previous version.
     *
     * @param name Module name.
     * @param steps Number of versions to go back (default = 1).
     */
    rollback(name: string, steps: number = 1): any {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);

        // No file path means only one-step memory rollback is possible
        if (!entry.path || !entry.versions || entry.versions.length === 0) {
            if (!entry.backup)
                throw Logger.error(`No backup found for module: ${name}`);

            const current = entry.instance;
            entry.instance = entry.backup;
            entry.backup = current;
            Logger.majorLog(`Rolled back module (in-memory only): ${name}`);
            return entry.instance;
        }

        const historyLength = entry.versions.length;
        const targetIndex = historyLength - 1 - steps;
        if (targetIndex < 0) {
            throw Logger.error(
                `Cannot rollback ${steps} step(s); only ${historyLength - 1} previous version(s) stored for module: ${name}`,
            );
        }

        const target = entry.versions[targetIndex];
        const code = this.vault.load(target.key);
        if (!code)
            throw Logger.error(
                `Cached version not found for module: ${name}, key: ${target.key}`,
            );

        // Restore that version’s code into the file, reload instance
        fs.writeFileSync(entry.path, code, "utf-8");
        delete require.cache[require.resolve(entry.path)];

        entry.backup = entry.instance;
        entry.instance = require(entry.path);

        // Trim newer versions (“future” revisions)
        entry.versions = entry.versions.slice(0, targetIndex + 1);
        entry.currentVersion = target.key;

        Logger.majorLog(
            `Rolled back module '${name}' to version ${target.key} (${new Date(
                target.createdAt,
            ).toISOString()})`,
        );

        return entry.instance;
    }

    /**
     * List all registered module names.
     */
    list(): string[] {
        return Object.keys(this.modules);
    }

    /**
     * Get stored version history for a given module.
     */
    history(name: string): ModuleVersionMeta[] {
        const entry = this.modules[name];
        if (!entry) throw Logger.error(`Module not registered: ${name}`);
        return entry.versions || [];
    }
}

export const patchModules = new PatchModules();
