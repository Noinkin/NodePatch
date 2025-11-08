# PatchModules

Patch Modules

## register()

Register a module instance in code

**Parameters:**
- `name` *(any)* — Unique module name
- `instance` *(any)* — Module instance (object or class instance)

## registerFromFile()

Register a module from a file path (optional)

**Parameters:**
- `name` *(string)* — Unique module name
- `modulePath` *(string)* — Path to JS/TS module

## get()

Get a registered module instance

**Parameters:**
- `name` *(string)* — Module Name

## reload()

Reload a module from its file path (if registered with a path)

**Parameters:**
- `name` *(string)* — Module to reload

## reloadInstance()

Reload a module with a new in-memory instance, useful for testing or manual hot-update without a file

**Parameters:**
- `name` *(string)* — Module to reload
- `newInstance` *(any)* — What to reload the module as

## rollback()

Rollback a module to previous version

**Parameters:**
- `name` *(string)* — Module to rollback

## list()

List all registered modules

