# AGENTS.md

This repository contains the `dashboard-maintenance` frontend bundle for a Home Assistant Lovelace strategy.
It is distributed as a HACS `Dashboard` repository, not as a custom integration.

## Scope

- Source TypeScript lives in `src/`
- Frontend build output is generated into `dist/dashboard-maintenance.js`
- Local publish tooling lives in `scripts/`

## Existing agent rules

- There are no additional local agent instruction files besides this `AGENTS.md`
- The surrounding Home Assistant core repository includes guidance, but this file should be treated as the local source of truth for this repo

## Key architecture

- `src/dashboard-maintenance.ts` registers the custom Lovelace dashboard and view strategies
- `src/dashboard-maintenance/editor.ts` registers the strategy editor UI
- `src/dashboard-maintenance/localize.ts` contains all user-facing strings and the translation helper
- `src/dashboard-maintenance/maintenance-dashboard-strategy.ts` generates full dashboards
- `src/dashboard-maintenance/maintenance-view-strategy.ts` generates single Lovelace views
- `src/dashboard-maintenance/maintenance-data.ts` builds the battery-focused maintenance dataset

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

This generates `dist/dashboard-maintenance.js`.

### Check built frontend JavaScript syntax

```bash
node --check dist/dashboard-maintenance.js
```

### Publish to a local Home Assistant instance

```bash
pnpm publish-to-local
```

The publish script copies the built bundle to a `/config/www/...` target and prints the Lovelace resource URL to register.

## Test guidance

There is currently no dedicated local test suite in this repo.

If you add tests later, prefer this structure:

- Put tests in `tests/`
- Use `pytest` for Python tooling only if Python code is reintroduced
- Prefer frontend/unit tests for strategy helpers when possible

## Recommended edit/verify workflow

1. Make code changes
2. Run `pnpm run build` after every change
3. Run `node --check dist/dashboard-maintenance.js`
4. Validate the bundle in Home Assistant with a registered Lovelace resource

## Frontend TypeScript style guidelines

- Use modern TypeScript with strict typing
- Keep the bundle self-contained and dependency-light
- Use `const` by default, `let` only when reassignment is necessary
- Prefer small pure helper functions for Lovelace config generation
- Use descriptive constant names for strategy defaults and UI copy
- Keep DOM usage limited to editor integration and custom element registration

### Imports and dependencies

- Bundle the frontend as a single ES module that Home Assistant can load as a Lovelace resource
- Keep dependencies small and only add packages needed for strategy generation or editors
- Do not edit generated build output directly

### Lovelace integration

- Prefer generating built-in Lovelace card and view config over custom rendering when possible
- Keep dashboard and view strategy behavior aligned when they share options
- Use built-in Home Assistant components like `ha-form` when available
- Avoid coupling the bundle to private frontend internals more than necessary

### Translations

- All user-facing strings must go through `localize()` from `src/dashboard-maintenance/localize.ts`
- Never hardcode user-visible English strings directly in strategy or editor code
- Add new translation keys to the `en` table in `localize.ts` before using them
- Thread `language?: string` (from `hass.locale?.language`) through functions that produce translated text
- When adding a new language, create a partial translation record in `localize.ts` — missing keys fall back to English

### Error handling

- Frontend registration should fail gracefully if Home Assistant has not finished booting
- Avoid noisy console output in normal operation

## Assets and generated files

- `dist/dashboard-maintenance.js` is generated and ignored by git
- `node_modules/` is ignored by git
- Do not edit generated build output directly

## Files to keep in sync

- If you change the generated frontend filename, update both:
  - `hacs.json`
  - `rolldown.config.mjs`
- If you change the fixed local publish destination, update both:
  - `README.md`
  - `scripts/publish-to-local.sh`
- If you add new user-facing strings, add them to `src/dashboard-maintenance/localize.ts`

## Agent dos and don'ts

- Do preserve Home Assistant Lovelace strategy conventions
- Do keep dashboard and view behavior aligned
- Do run `pnpm run build` after every change
- Do verify syntax after changes
- Do prefer minimal, targeted edits over broad rewrites
- Do remove dead code when it is clearly unused
- Do not add unrelated tooling unless it directly supports this repo
- Do not commit generated build output unless the workflow explicitly requires it
- Do not hardcode user-facing strings — always use `localize()` from `localize.ts`

## Good final verification checklist

- `pnpm install`
- `pnpm run build`
- `node --check dist/dashboard-maintenance.js`
- Register the resource in Home Assistant and confirm the custom strategy resolves in Lovelace
