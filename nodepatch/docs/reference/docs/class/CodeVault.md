# CodeVault

**CodeVault**

A lightweight, persistent store for formatted module code strings or Buffers.
Automatically compresses using Brotli for storage efficiency,
but preserves all original formatting.

Designed for dynamic module reloading, hot-swapping, and rollback systems.

---
### Example
```ts
const vault = new CodeVault({ backend: "sqlite" });
vault.store("core@1.0.0", "export default () => {\n  return 'Hello';\n}");
console.log(vault.load("core@1.0.0"));
vault.close();
```

## store()

Compresses and stores code.

**Parameters:**
- `key` *(any)* — A unique version key (e.g., `"core@1.2.3"`).
- `code` *(any)* — The code string or Buffer to store.

- Preserves formatting (no newline removal).
- Uses Brotli compression for efficient storage.
- In file mode, creates a `.js.br` file.
- In SQLite mode, stores a compressed BLOB.

If the key already exists, it is **overwritten**.

## load()

Loads, decompresses, and returns the stored code as a UTF-8 string.

**Parameters:**
- `key` *(any)* — The key identifying the stored code version.

**Returns:** 

## remove()

Deletes a stored code version from persistent storage.

**Parameters:**
- `key` *(any)* — The key of the module to delete.

## close()

Closes the SQLite database connection.

Has no effect in file mode.

