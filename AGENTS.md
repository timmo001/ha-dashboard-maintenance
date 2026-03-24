# AGENTS.md

This repository contains the `dashboard_maintenance` Home Assistant custom integration.
It combines a small Python backend that registers static assets and injects a frontend module with a TypeScript frontend bundle that registers custom Lovelace strategies.

## Scope

- Python backend files live at the repo root
- Frontend runtime code is built into `www/dashboard-maintenance.js`
- Source TypeScript lives in `src/`

## Existing agent rules

- There is no local `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` in this repository
- The surrounding Home Assistant core repository includes guidance, but this file should be treated as the local source of truth for this component repo

## Key architecture

- `__init__.py` registers the static path and injects the frontend module
- `config_flow.py` provides a single-instance config flow so the strategy bundle can be enabled once
- `const.py` contains integration constants and asset names
- `src/dashboard-maintenance.ts` registers the custom Lovelace dashboard and view strategies

## Setup commands

Run all commands from the repository root unless noted otherwise.

### Install frontend build dependencies

```bash
pnpm install
```

### Build generated frontend assets

```bash
pnpm run build
```

This generates `www/dashboard-maintenance.js`.

### Check built frontend JavaScript syntax

```bash
node --check www/dashboard-maintenance.js
```

### Check Python syntax by compiling the package

```bash
python -m compileall .
```

To avoid noisy output from nested directories, you can compile just the main Python modules:

```bash
python -m compileall __init__.py config_flow.py const.py
```

## Test guidance

There is currently no dedicated local test suite in this component repo.

If you add tests later, prefer this structure:

- Put Python tests in `tests/`
- Use `pytest`
- Keep frontend logic isolated enough to test helper behavior separately when possible

### Run all tests once a test suite exists

```bash
pytest
```

### Run a single test file

```bash
pytest tests/test_config_flow.py
```

### Run a single test by name

```bash
pytest tests/test_config_flow.py -k single_instance
```

### Run a single node of a single test

```bash
pytest tests/test_config_flow.py::test_single_instance_allowed
```

## Recommended edit/verify workflow

1. Make code changes
2. Run `pnpm run build` after every change
3. Run `node --check www/dashboard-maintenance.js`
4. Run `python -m compileall __init__.py config_flow.py const.py`
5. Reload Home Assistant and verify behavior in the browser

## Python style guidelines

- Follow modern Home Assistant integration patterns
- Use `from __future__ import annotations` in Python modules
- Keep modules small and focused on one concern
- Prefer typed constants in `const.py` using `Final`
- Use explicit return types for helper functions when practical
- Use `HomeAssistant`, `ConfigEntry`, and other concrete Home Assistant types instead of `Any` whenever possible
- Use `dict[str, Any]` only at true integration boundaries like websocket payloads or config-entry data

### Imports

- Group imports in this order:
  1. standard library
  2. Home Assistant / third-party
  3. local imports
- Prefer one import per symbol group rather than wildcard imports
- Keep imports alphabetized within a group when it does not hurt readability

### Naming

- Use `snake_case` for functions, variables, and module-level helpers
- Use `UPPER_SNAKE_CASE` for constants
- Use descriptive private helper names prefixed with `_`
- Name websocket commands and signal constants clearly and consistently with the domain

### Formatting

- Follow Black-style Python formatting
- Keep line length readable even if tooling allows longer lines
- Use multiline imports when a single line becomes hard to scan
- Prefer small helper functions over deeply nested logic

### Error handling

- Fail safely when browser or integration state is unavailable
- Use defensive defaults for config payloads
- Avoid broad `except` blocks unless you re-raise or return a clear fallback
- When a setup path can fail, prefer a clean fallback over partially initialized state
- Keep websocket handlers simple and side-effect light

### Home Assistant conventions

- Prefer `@callback` for synchronous callback helpers
- Use dispatcher signals for lightweight in-process update notifications
- Keep config entries single-purpose and single-instance unless multi-instance support is intentional
- Avoid YAML config support unless explicitly needed; this repo currently uses config entries

## Frontend TypeScript style guidelines

- Use modern TypeScript with strict typing
- Keep the bundle self-contained and dependency-light
- Use `const` by default, `let` only when reassignment is necessary
- Prefer small pure helper functions for Lovelace config generation
- Use descriptive constant names for strategy defaults and UI copy
- Keep DOM usage limited to editor integration and custom element registration

### Imports and dependencies

- Bundle the frontend as a single ES module that Home Assistant can load with `frontend.add_extra_js_url`
- Keep dependencies small and only add packages needed for strategy generation or editors
- Do not commit hand-written generated build output

### Lovelace integration

- Prefer generating built-in Lovelace card and view config over custom rendering when possible
- Keep dashboard and view strategy behavior aligned when they share options
- Use built-in Home Assistant components like `ha-form` for editor UI when available
- Avoid coupling the bundle to private frontend internals more than necessary

### Error handling

- Frontend registration should fail gracefully if Home Assistant has not finished booting
- Avoid noisy console output in normal operation

## Assets and generated files

- `www/dashboard-maintenance.js` is generated and ignored by git
- `node_modules/` is ignored by git
- Do not edit generated build output directly

## Files to keep in sync

- If you change the integration version, update both:
  - `const.py`
  - `manifest.json`
- If you add a build dependency, update both:
  - `package.json`
  - `scripts/build.mjs`
- If you change the generated frontend filename, update both:
  - `const.py`
  - `rolldown.config.mjs`

## Agent dos and don'ts

- Do preserve Home Assistant integration conventions
- Do keep backend and frontend behavior aligned
- Do run `pnpm run build` after every change
- Do verify syntax after changes
- Do prefer minimal, targeted edits over broad rewrites
- Do remove dead code when it is clearly unused
- Do not add unrelated tooling unless it directly supports this repo
- Do not commit generated build output unless the workflow explicitly requires it
- Do not introduce another configuration path when config entries already solve the problem

## Good final verification checklist

- `pnpm install`
- `pnpm run build`
- `node --check www/dashboard-maintenance.js`
- `python -m compileall __init__.py config_flow.py const.py`
- Reload the Home Assistant UI and confirm the custom strategy resolves in Lovelace
