/**
 * Patch Packages
 * @class
 */
export class PatchPackages {
    private packages: Record<string, any> = {};

    /**
     * Import a package
     * @param name {string} Package name
     */
    get<T = any>(name: string): T {
        if (!this.packages[name]) {
            this.packages[name] = require(name);
        }
        return this.packages[name] as T;
    }

    /**
     * Reload a package by its name
     * @param name {string} Package name
     */
    reload<T = any>(name: string): any {
        const resolvedPath = require.resolve(name);
        this.clearCache(resolvedPath);
        this.get(name);
        return this.get(name) as T;
    }

    /**
     * Reloads all packages
     */
    reloadAll() {
        Object.keys(this.packages).forEach((name) => this.reload(name));
    }

    /**
     * Clears import cache of a module
     * @param modulePath {string} Filepath of module
     */
    clearCache(modulePath: string) {
        const mod = require.cache[modulePath];
        if (mod) {
            for (const child of mod.children) {
                this.clearCache(child.id);
            }
            delete require.cache[modulePath];
        }
    }
}

export const patchPackages = new PatchPackages();
