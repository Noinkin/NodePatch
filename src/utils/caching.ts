import fs from "fs";
import path from "path";
import zlib from "zlib";
import Database from "better-sqlite3";

export type CacheBackend = "file" | "sqlite";

export interface CacheOptions {
  /** 
   * Base directory where all cached modules are stored.  
   * Defaults to `<project>/.vault`.
   */
  baseDir?: string;

  /**
   * Storage backend to use:
   * - `"file"` → individual compressed `.js.br` files in the base directory  
   * - `"sqlite"` → compressed binary blobs in a single SQLite database  
   * Defaults to `"sqlite"`.
   */
  backend?: CacheBackend;

  /** 
   * Name of the SQLite database file (ignored in file mode).  
   * Defaults to `"codevault.db"`.
   */
  dbName?: string;
}

/**
 * **CodeVault**
 * 
 * A lightweight, persistent store for formatted module code strings or Buffers.  
 * Automatically compresses using Brotli for storage efficiency, 
 * but preserves all original formatting.
 * 
 * Designed for dynamic module reloading, hot-swapping, and rollback systems.
 * 
 * ---
 * ### Example
 * ```ts
 * const vault = new CodeVault({ backend: "sqlite" });
 * vault.store("core@1.0.0", "export default () => {\n  return 'Hello';\n}");
 * console.log(vault.load("core@1.0.0"));
 * vault.close();
 * ```
 */
export class CodeVault {
  /** Absolute path to the storage directory. */
  private baseDir: string;

  /** Selected backend type (`file` or `sqlite`). */
  private backend: CacheBackend;

  /** Full file path to the SQLite database. */
  private dbPath: string;

  /** Database handle (only defined in SQLite mode). */
  private db?: Database.Database;

  /**
   * Creates a new CodeVault instance.
   * 
   * @param options Optional configuration:
   *  - `baseDir`: root directory for stored data  
   *  - `backend`: `"file"` or `"sqlite"`  
   *  - `dbName`: name of the SQLite database file  
   * 
   * When using SQLite, a `code_store` table is created automatically.
   */
  constructor(options?: CacheOptions) {
    this.baseDir = options?.baseDir || path.resolve(process.cwd(), ".vault");
    this.backend = options?.backend || "sqlite";
    this.dbPath = path.join(this.baseDir, options?.dbName || "codevault.db");

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    if (this.backend === "sqlite") {
      this.db = new Database(this.dbPath);
      this.db
        .prepare(
          `CREATE TABLE IF NOT EXISTS code_store (
             key TEXT PRIMARY KEY,
             code BLOB,
             created_at INTEGER
           )`
        )
        .run();
    }
  }

  /**
   * Compresses and stores code.
   * 
   * @param key A unique version key (e.g., `"core@1.2.3"`).  
   * @param code The code string or Buffer to store.
   * 
   * - Preserves formatting (no newline removal).  
   * - Uses Brotli compression for efficient storage.  
   * - In file mode, creates a `.js.br` file.  
   * - In SQLite mode, stores a compressed BLOB.  
   * 
   * If the key already exists, it is **overwritten**.
   */
  public store(key: string, code: string | Buffer): void {
    const rawData = Buffer.isBuffer(code) ? code : Buffer.from(code, "utf-8");
    const compressed = zlib.brotliCompressSync(rawData);

    if (this.backend === "file") {
      const filePath = path.join(this.baseDir, `${key}.js.br`);
      fs.writeFileSync(filePath, compressed);
    } else if (this.db) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO code_store (key, code, created_at)
           VALUES (?, ?, ?)`
        )
        .run(key, compressed, Date.now());
    }
  }

  /**
   * Loads, decompresses, and returns the stored code as a UTF-8 string.
   * 
   * @param key The key identifying the stored code version.
   * @returns The original code string, or `undefined` if not found.
   * 
   * - Decompresses Brotli data back to text.  
   * - Preserves all line breaks and indentation.
   */
  public load(key: string): string | undefined {
    let compressed: Buffer | undefined;

    if (this.backend === "file") {
      const filePath = path.join(this.baseDir, `${key}.js.br`);
      if (!fs.existsSync(filePath)) return undefined;
      compressed = fs.readFileSync(filePath);
    } else if (this.db) {
      const row = this.db.prepare(`SELECT code FROM code_store WHERE key = ?`).get(key);
      if (row) compressed = row.code;
    }

    if (!compressed) return undefined;

    const decompressed = zlib.brotliDecompressSync(compressed);
    return decompressed.toString("utf-8");
  }

  /**
   * Deletes a stored code version from persistent storage.
   * 
   * @param key The key of the module to delete.
   */
  public remove(key: string): void {
    if (this.backend === "file") {
      const filePath = path.join(this.baseDir, `${key}.js.br`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else if (this.db) {
      this.db.prepare(`DELETE FROM code_store WHERE key = ?`).run(key);
    }
  }

  /**
   * Closes the SQLite database connection.
   * 
   * Has no effect in file mode.
   */
  public close(): void {
    if (this.db) this.db.close();
  }
}
