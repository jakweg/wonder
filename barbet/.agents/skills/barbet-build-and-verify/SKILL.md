---
name: barbet-build-and-verify
description: >-
  Compile .2bc.json enum dispatch files, run full TypeScript typechecks,
  and bundle or run headless verification scripts for the barbet package in Wonder.
  Use whenever editing .2bc.json files, running tsc, or verifying barbet game-state
  and WebGL2 rendering changes.
---

# `barbet` Build, Codegen, and Verification

`barbet/` does not have its own `package.json`; build tools live in `/workspaces/wonder/encytem` (`esbuild` + `compile-enums.ts`). Avoid `/workspaces/wonder/slimeworm/node_modules/.bin/{tsc,prettier}`, which are outdated (TS 4.7 / Prettier 2) and do not support `es2024` or `satisfies`.

## 1. Compile `.2bc.json` Enum & Dispatch Files

Whenever creating or editing any `*.2bc.json` file under `barbet/src/`, regenerate its `.ts` output from `/workspaces/wonder/barbet`:

```bash
cd /workspaces/wonder/barbet && \
/workspaces/wonder/encytem/node_modules/.bin/esbuild /workspaces/wonder/encytem/src/build/compile-enums.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/compile-enums.mjs && \
node -e 'import("/tmp/compile-enums.mjs").then(m => m.doEnumCompilation())'
```

## 2. Typecheck (`tsc --noEmit`)

Run full project typechecking from `/workspaces/wonder/barbet`:

```bash
cd /workspaces/wonder/barbet && \
npx --yes -p typescript tsc --noEmit
```

## 3. Bundle Entrypoints & Run Headless Node Verification

Bundling `barbet` modules with `esbuild` requires `_C_*` build constants. When running headless tests in Node, also stub browser globals (`location`, `self`, `localStorage`) read at module init:

```bash
ESBUILD="/workspaces/wonder/encytem/node_modules/.bin/esbuild"
DEFINES="--define:_C_DEBUG=true --define:_C_JS_ROOT='\"\"' --define:_C_COMMIT_HASH='\"dev\"' --define:_C_CODE_STATS_LINES_COUNT=0"
BANNER="--banner:js=globalThis.location={};globalThis.self=globalThis;globalThis.localStorage={getItem:()=>null,setItem:()=>{}};"

# Bundle and run a scratch verification script in Node:
cd /workspaces/wonder/barbet && \
"$ESBUILD" /path/to/verify.ts --bundle --platform=node --format=esm \
  --tsconfig=/workspaces/wonder/barbet/tsconfig.json $DEFINES $BANNER \
  --outfile=/tmp/verify.mjs && \
node /tmp/verify.mjs

# Verify all browser/worker entrypoints bundle cleanly:
cd /workspaces/wonder/barbet && \
"$ESBUILD" src/main/entry-points/main.ts src/main/entry-points/update-worker.ts src/main/entry-points/render-worker.ts \
  --bundle --format=esm --tsconfig=/workspaces/wonder/barbet/tsconfig.json $DEFINES \
  --outdir=/tmp/barbet-dist-check
```
