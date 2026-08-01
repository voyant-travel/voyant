# voyant#3994 — operator Docker boot verification

Verifying candidate fix `c45c451b4` ("fix(runtime): let the built operator server
start without dev tooling") on branch `agent/claude--context-you-are-verifyi-074247`.
Host: lab1 (`pxm-code-sandbox-1`), Docker. All runs use throwaway local credentials.

## Verdict

**The fix is INSUFFICIENT. The operator image still cannot boot: it never binds a
port.** The `tsx` ESM *link-time* error is genuinely cleared (real progress), but
three further independent blockers sit behind it, the last of which is a design
gap that no environment tweak can bridge.

## What the fix did achieve

The static `import { tsImport } from "tsx/esm/api"` in `project-artifacts.ts` is
gone from the module graph, so the process no longer dies at ESM link time with
`Cannot find package 'tsx' imported from /app/dist/server/server.js` "about a
second in, before reading any environment variable." That specific symptom from
the issue is fixed. Execution now reaches runtime.

## Blocker chain (each proven, in the order the real image hits them)

### Blocker 1 — `@pdf-lib/fontkit` MODULE_NOT_FOUND (the actual next blocker)
`boot-selfhosted.log`. The unmodified image (`voyant-operator-fix`) with the
self-hosted env dies at runtime:

```
Error: Cannot find module '@pdf-lib/fontkit'
    at createBundledDocumentRenderer (file:///app/dist/server/server.js:52435:106)
    at Object.resolveResource (file:///app/dist/server/server.js:52234:99)
```

The `index.ts` fix's "fall back to the host require" does not help, because
`@pdf-lib/fontkit` is **not present at any Node-resolvable path** in the deployed
tree. Probing resolution from every anchor inside the image:

```
host->fontkit                 FAIL -> MODULE_NOT_FOUND
host->runtime                 FAIL -> MODULE_NOT_FOUND   (@voyant-travel/runtime itself won't resolve)
host->inter-tight             OK   -> .../inter-tight/index.css   (operator declares this directly)
```

Both anchors in `anchoredRequire` throw, so everything falls back to the host
require, and the host require cannot find fontkit either. fontkit exists only as
an **un-linked pnpm store entry**: `node_modules/.pnpm/node_modules/@pdf-lib/fontkit`
(a symlink into `.pnpm/@pdf-lib+fontkit@1.1.1/...`), which is on no module
resolution path. Root cause: `@pdf-lib/fontkit` is a dependency of the workspace
package `@voyant-travel/utils`, which Vite inlines into the bundle from source;
`pnpm deploy --prod --legacy` therefore ships `utils` as a shell (README +
package.json only) and never hoists its transitive `fontkit` to top level.

### Blocker 2 — `tsx` needed at runtime, ERR_MODULE_NOT_FOUND
`boot-nodepath-tsx.log`. Making fontkit resolvable (workaround: run with
`NODE_PATH=/app/node_modules/.pnpm/node_modules`, which satisfies CJS `require`
only) advances the boot into:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx' imported from /app/dist/server/server.js
```

This comes from `loadGeneratedProjectLinks` (`index.ts:295`, called
**unconditionally** at boot), which calls `loadTsImport()` — i.e. the *dynamic*
`import("tsx/esm/api")` the fix introduced — **before** the ENOENT guard. So the
fix's premise that "a built server never reaches [the tsx loaders]" is **false**:
the built server reaches one on every boot. `tsx` is a devDependency stripped by
`pnpm deploy --prod`, so the lazy import fails the same way the static one did —
it merely moved the failure from link time to runtime. (`NODE_PATH` does not help
ESM resolution, which is why this surfaces.)

### Blocker 3 — project-links artifact imports UNSHIPPED workspace source
`boot-overlay-projectlinks.log`. Linking the entire `.pnpm` store to top level
(workaround overlay so `tsx` resolves and can transpile) advances into:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/app/dist/node_modules/@voyant-travel/operator-standard/node_modules/@voyant-travel/accommodations/src/standard-links.ts'
  imported from /app/dist/.voyant/runtime/project-links.generated.ts
```

`dist/.voyant/runtime/project-links.generated.ts` **is shipped** and is a
TypeScript **source** artifact whose imports point at workspace-package **source**
files:

```
import { programRoomBlockLink as link0 } from
  "../../node_modules/@voyant-travel/operator-standard/node_modules/@voyant-travel/accommodations/src/standard-links.ts"
```

No `src/` directory is shipped for any `@voyant-travel/*` package (they ship as
README + package.json + migrations/openapi shells). The referenced
`.../accommodations/src/standard-links.ts` does not exist anywhere in the image.
**This cannot be worked around from the environment — the source is simply not in
the image.** It is the same source-vs-deployed-tree mismatch the commit message
identifies, but for the project-links path, which the fix did not address.

## Answers to the seven questions

1. **Builds?** Yes. `docker build` exit 0, **2:38.98** wall-clock, image **1.5 GB**.
   (`build.log`.)
2. **Boots past ESM link time and binds a port?** Gets **past ESM link time (yes)**;
   **binds a port: NO.** Dies at runtime on blocker 1 during graph/resource
   composition, before any port bind.
3. **Exact next blocker:** `Cannot find module '@pdf-lib/fontkit'` in
   `createBundledDocumentRenderer` — not resolvable from host or workspace-shell
   anchors; present only in the un-linked `.pnpm` store.
4. **Does `/healthz` need a migrated database?** **Untestable here** — the server
   never binds, so `/healthz` is never reachable. The crash is in project/graph
   loading and is unrelated to the database; boot dies before any DB connection or
   schema check, so a migrated DB would not change the outcome. Whether `/healthz`
   needs a schema remains open because we could not get a listening server.
5. **Minimum env set:** **Not determinable empirically** — you cannot subtract
   variables from a server that never starts. The env used (from `.env.example`
   with `local`/`better-auth`/`local` KMS) is in `env-minimal.txt` (secrets
   redacted); none of it was ever read, since the crash precedes env consumption
   past the very first resource resolution.
6. **One image, two KMS configs?** **Not observable** — `KMS_PROVIDER=env` +
   `KMS_ENV_KEY` on the same image (`boot-kms-env.log`) crashes at the **identical**
   `@pdf-lib/fontkit` error, before any KMS logic runs (grep for `KMS` in the log:
   0 hits). KMS selection is env-driven in source, but this cannot be confirmed at
   runtime because neither configuration boots.
7. **Is `VOYANT_ADMIN_AUTH_MODE` from the env honoured or ignored?** **Ignored** —
   confirmed by source, **not** observed at runtime (the server never boots;
   `boot-authmode-override.log` crashes at the same fontkit error, 0 hits for any
   auth-mode string). Source: `packages/framework/src/node-runtime.ts:298-302`
   builds `providerEnv` by spreading `process.env` first and then
   **overwriting** `VOYANT_ADMIN_AUTH_MODE` with
   `selectedNodeAuthMode(options.deployment.providers)` — the build-resolved
   provider plan. `selectedNodeAuthMode` (lines 272-281) maps `adminAuth`
   `"better-auth" -> "local"`, `"voyant-cloud" -> "voyant-cloud"`. The environment
   value is therefore discarded regardless of what the operator sets. The claim is
   consistent with source but I could not exercise it against a running server.

## Which items were RUN vs INFERRED

- RUN (observed): build; self-hosted boot; fontkit resolution probe; NODE_PATH
  boot; overlay boot; KMS=env boot; authmode=voyant-cloud boot; image/tree
  inspection.
- INFERRED (source only, could not observe because no boot): auth-mode override
  behaviour (#7); KMS env-driven selection (#6); `/healthz` DB requirement (#4);
  minimum env set (#5).

## Workarounds used (none are the fix; all documented)

- `NODE_PATH=/app/node_modules/.pnpm/node_modules` — to advance past blocker 1
  (CJS-only) and reveal blocker 2.
- Overlay image `voyant-operator-fix-overlay` (symlinks `.pnpm` store to top-level
  `node_modules`) — to advance past blocker 2 and reveal blocker 3.
- Both were exploratory only, to map the blocker chain. Per the task constraint I
  did **not** attempt a second code fix. Blocker 3 is unworkaroundable from the
  environment.

## Bottom line

The `tsx` link-time death is fixed, but the operator image is still unbootable.
The deployed tree (`pnpm deploy --prod --legacy` of a Vite build that inlines
workspace packages from source) is missing three things a boot needs: the
`@pdf-lib/fontkit` transitive dependency at a resolvable path; the `tsx`
transpiler that `loadGeneratedProjectLinks` invokes unconditionally at boot; and
the workspace **source** `.ts` files that the shipped `project-links.generated.ts`
imports. The last is architectural: a source artifact ships into a tree that
carries no source.
