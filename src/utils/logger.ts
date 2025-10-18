export class Logger {
    public static log(msg: string) {
        console.log(`[NodePatch] ${msg}`);
    }
    public static majorLog(msg: string) {
        console.log(`\n──────────────────────────────────────────────────`);
        console.log(`\n[NodePatch] ${msg}\n`);
        console.log(`──────────────────────────────────────────────────\n`);
    }
    public static warn(msg: string) {
        console.warn(`[NodePatch] WARNING: ${msg}`);
    }

    public static error(msg: string) {
        throw new Error(`[NodePatch] ERROR: ${msg}`);
    }
}
