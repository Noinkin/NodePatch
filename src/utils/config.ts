import fs from "fs";
import path from "path";

const configPath = '../config.json';

export function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export let config = loadConfig();

export function saveConfig(newConfig: any) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  config = newConfig;
}
