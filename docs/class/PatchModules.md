# PatchModules

Patch Modules

## register()

Register a module instance in code

**Parameters:**

- `name` _(any)_ — Unique module name
- `instance` _(any)_ — Module instance (object or class instance)

## registerFromFile()

Register a module from a file path (optional)

**Parameters:**

- `name` _(string)_ — Unique module name
- `modulePath` _(string)_ — Path to JS/TS module

## get()

Get a registered module instance

**Parameters:**

- `name` _(string)_ — Module Name

## reload()

Reload a module from its file path (if registered with a path)

**Parameters:**

- `name` _(string)_ — Module to reload

## reloadInstance()

Reload a module with a new in-memory instance, useful for testing or manual hot-update without a file

**Parameters:**

- `name` _(string)_ — Module to reload
- `newInstance` _(any)_ — What to reload the module as

## rollback()

Rollback a module to previous version

**Parameters:**

- `name` _(string)_ — Module to rollback

## list()

List all registered modules
