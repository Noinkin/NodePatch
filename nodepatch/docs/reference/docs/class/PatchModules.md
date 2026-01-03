# PatchModules

PatchModules — dynamic module registry and hot-swap manager.

- Tracks all registered modules.
- Supports in-memory reloads and file reloads.
- Integrates with CodeVault to store compressed historical versions.
- Allows rollback to any previously stored version.

## makeVersionKey()

Generate a version key with module name and timestamp.

## register()

Register a module instance created in memory (no file tracking).

## registerFromFile()

Register a module from a file path (enables multi-version rollback).

## get()

Retrieve a registered module instance by name.

## reload()

Reload a file-backed module and store a new compressed version in CodeVault.

## reloadInstance()

Reload a module with a new in-memory instance.
Optionally stores the provided source code into CodeVault for rollback.

## rollback()

Rollback a module to a previous version.

**Parameters:**

- `name` _(any)_ — Module name.
- `steps` _(any)_ — Number of versions to go back (default = 1).

## list()

List all registered module names.

## history()

Get stored version history for a given module.
