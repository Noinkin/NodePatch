import fs from "fs";

export function loadConfig() {
    return JSON.parse(fs.readFileSync(`${process.cwd()}/.nodepatch`, "utf8"));
}

export let config = loadConfig();

export function saveConfig(newConfig: any) {
    fs.writeFileSync(
        `${process.cwd()}/.nodepatch`,
        JSON.stringify(newConfig, null, 2),
    );
    config = newConfig;
}

type ConfigSchema = Record<string, "string" | "number" | "boolean">;

export const configSchema: ConfigSchema = {
    max_rollback_cache: "number",
};
