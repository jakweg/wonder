---
name: barbet-build-and-verify
description: >-
  Format, typecheck, compile .2bc.json enums, and bundle or run headless
  verification scripts for the barbet package in Wonder. Use whenever editing
  TypeScript, WebGL2 shaders, ECS stores, or .2bc.json files in barbet/.
---

# `barbet` Build, Property Mangling, and Verification

`barbet/` has no `package.json`; build tooling lives in `/workspaces/wonder/encytem` (`esbuild` + `compile-enums.ts`), and formatting config lives in `/workspaces/wonder/barbet/.prettierrc.json`. Avoid `/workspaces/wonder/slimeworm/node_modules/.bin/{tsc,prettier}` (outdated TS 4.7 / Prettier 2).

## 1. Property Mangling Guardrails (`mangleProps: /./`)

Production builds (`encytem/src/build/index.ts`) run a second `esbuild` pass with `mangleProps: /./` reserved against `barbet/src/build/exclude-from-mangling.txt`:

- **Never look up object properties via string literals** (e.g. `bones['Torso']` breaks when `{ Torso: ... }` mangles to `{ Xt: ... }`). Use single-key object references (`{ Torso: true }`) extracted via `Object.keys(ref)[0]` so definition and usage mangle identically, or numeric `const enum` indices.
- **Keep `exclude-from-mangling.txt` up to date:** When introducing a standard WebGL2, DOM, or JS built-in property/method not yet listed in `barbet/src/build/exclude-from-mangling.txt`, add it in alphabetical order (or bracket-quote one-off dynamic accesses like `Object['assign']`).

## 2. Compile `.2bc.json` Without Clobbering Other Files

See the `enum-compiler-2bc` skill for schema details. Because `barbet/` has no local `node_modules/.bin/prettier`, running `compile-enums.ts` directly inside `barbet/` overwrites **all** generated `.ts` files unformatted. Compile modified `.2bc.json` files in an isolated `/tmp` directory, copy the output `.ts` back, and format with `barbet/.prettierrc.json`:

```bash
ESBUILD="/workspaces/wonder/encytem/node_modules/.bin/esbuild"
"$ESBUILD" /workspaces/wonder/encytem/src/build/compile-enums.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/compile-enums.mjs
rm -rf /tmp/compile-2bc && mkdir -p /tmp/compile-2bc/src
cp /workspaces/wonder/barbet/src/path/to/file.2bc.json /tmp/compile-2bc/src/
(cd /tmp/compile-2bc && node /tmp/compile-enums.mjs)
cp /tmp/compile-2bc/src/<output-file>.ts /workspaces/wonder/barbet/src/path/to/<output-file>.ts
rm -rf /tmp/compile-2bc /tmp/compile-enums.mjs
npx --yes -p prettier prettier --config /workspaces/wonder/barbet/.prettierrc.json \
  --write /workspaces/wonder/barbet/src/path/to/<output-file>.ts
```

## 3. Format & Typecheck (`prettier` + `tsc --noEmit`)

Always pass `--config /workspaces/wonder/barbet/.prettierrc.json` (especially for files outside `barbet/`):

```bash
cd /workspaces/wonder/barbet && \
npx --yes -p prettier prettier --config .prettierrc.json --write <touched-files...> && \
npx --yes -p typescript tsc --noEmit
```

## 4. Bundle Entrypoints & Run Headless Node Verification

Bundling `barbet` modules with `esbuild` requires `_C_*` build constants. When running headless tests in Node, stub browser globals (`location`, `self`, `localStorage`) read at module init:

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
