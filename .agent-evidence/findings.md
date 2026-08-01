# Operator image boot verification — findings (voyant#3994 follow-up)

Branch: agent/claude--context-the-operator-do-091153
Host: lab1, Docker 29.4.0, node:22-slim base.

## Verdict

The build succeeds and the deployment mechanism does most of what it claims:
manifests are rewritten to `dist`, and `tsx` + `@pdf-lib/fontkit` are present in
the deployed pnpm store. **But the image still does not boot.** Two distinct,
config-independent blockers remain, both the same disease as #3994
(build-from-source assumptions that don't survive `pnpm deploy --prod`).

## 1. Build — PASS

- `docker build -f starters/operator/Dockerfile -t voyant-operator-fixed .` → exit 0
- Wall-clock: 673s (~11 min)
- Image size: 1.58GB
- `NODE_OPTIONS=--max-old-space-size=8192` held; no tsc OOM.

## 2. Deployed tree — mechanism mostly worked

- `/app/node_modules/@voyant-travel/` contains 31 real top-level packages
  (pnpm `file:` links into `.pnpm/` store).
- Manifest `exports["."]` point at **dist** (transform applied, publishConfig
  stripped): framework `./dist/index.js`, runtime `./dist/index.js`,
  admin-host `./dist/index.js`, utils `./dist/index.js`.
- `@pdf-lib/fontkit@1.1.1` — PRESENT in `.pnpm` store.
- `tsx@4.22.4` — PRESENT in `.pnpm` store, BUT NOT linked at
  `/app/node_modules/tsx` (see blocker A).

## 3. Boot — FAIL (does not pass ESM link time / never binds a port)

### Blocker A — `tsx` unresolvable from server.js (base image)
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx'
  imported from /app/dist/server/server.js
```
- `server.js` reaches `loadGeneratedProjectLinks()` at startup, which calls
  `loadTsImport()` → `import("tsx/esm/api")`.
- The design comment in `packages/runtime/src/project-artifacts.ts` claims a
  BUILT server never reaches the tsImport path (project-runtime is pulled via
  eager `import.meta.glob`). **That is true for project-runtime but FALSE for
  project LINKS** — `loadGeneratedProjectLinks` is a separate runtime call that
  still uses `tsImport`, so the server unconditionally needs `tsx` at boot.
- `tsx` is only an operator **devDependency** (`"tsx": "catalog:"`), stripped by
  `pnpm deploy --prod`. It is a real dependency of `@voyant-travel/runtime`, but
  that copy lives in runtime's nested `.pnpm` dir and is NOT resolvable from
  `/app/dist/server/server.js` (node walks dist/server → dist → /app/node_modules,
  none contain `tsx`). So the "tsx arrives as a real transitive dependency"
  expectation is false for the operator's own import site.

### Blocker B — project-links imports unshipped `.ts` source (behind A)
Supplying `tsx` via a throwaway symlink probe (`/app/node_modules/tsx` →
store copy; NOT a repo change) reveals the next, deeper blocker:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/app/dist/node_modules/@voyant-travel/operator-standard/node_modules/@voyant-travel/accommodations/src/standard-links.ts'
  imported from /app/dist/.voyant/runtime/project-links.generated.ts
```
- `project-links.generated.ts` hardcodes deep **relative** imports into
  `src/standard-links.ts` — bypassing each package's `exports` map, so
  `apply-publish-config.mjs` (which only rewrites manifest `exports`) never
  helps it.
- Two failures compound: (1) the base path `../../node_modules` resolves to
  `/app/dist/node_modules`, which does not exist; (2) even the real
  accommodations package ships only `dist/ migrations/ openapi/` — no `src/`
  (`files: ["dist"]`), so `src/standard-links.ts` was never shipped.
- This is the SAME "src not shipped" root cause #3994 set out to kill, surviving
  in the generated project-links artifact rather than in package manifests.

## 4. Exact next blocker
Blocker A (`tsx`). Behind it, Blocker B (project-links → unshipped src). Both
must be fixed for boot. **No application-code fix attempted (per constraints).**

## 5. Does /healthz need a migrated database?
Not reachable to test (server never boots). From source: `/healthz` returns a
static `"ok"` in `packages/runtime-core/src/node-server.ts:103-104`, short-
circuited before the trust gate and any DB access — so once booting it would
NOT need a migrated DB. The DB itself is never touched by boot before the crash.

## 6. Minimum env set — UNDETERMINABLE at runtime
The crash is env-independent (same failure with the full documented env), and
happens during module load / graph composition before any env contract is
exercised, so the empirically-minimal set cannot be derived. `env-minimal.txt`
records the documented required set used (secrets redacted), NOT an empirically
minimized one.

## 7. One image, two KMS configs — UNPROVEN by observation
Same image run with `KMS_PROVIDER=local` and `KMS_PROVIDER=env` both crash
identically at Blocker A (`boot-kms-env.log`). The image is byte-identical and
KMS is env-selected in source, but serving cannot be demonstrated because the
crash precedes KMS resolution. Config-agnostic up to the crash; product claim
not verifiable at runtime with this image.

## 8. Is VOYANT_ADMIN_AUTH_MODE honoured or ignored? — IGNORED (from source; not observable)
Could NOT be observed at runtime (server does not boot; base image with
`VOYANT_ADMIN_AUTH_MODE=voyant-cloud` crashes at Blocker A identically —
`boot-authmode-override.log`). From source, the claim holds:
`packages/framework/src/node-runtime.ts:298-301` spreads `process.env` first,
then **overwrites** `VOYANT_ADMIN_AUTH_MODE` with
`selectedNodeAuthMode(options.deployment.providers)` (build-resolved provider
plan). So an env-supplied value is discarded. This remains a source-level
conclusion, NOT a runtime observation — the same status as before this task.

## Items RUN vs INFERRED
- RUN: build; deployed-tree inspection; base-image boot (x3: local, kms=env,
  authmode=voyant-cloud); probe-image boot (tsx supplied) x2.
- INFERRED (could not observe, server never boots): /healthz DB-independence,
  minimum env set, KMS product claim, auth-mode override.

## Probe disclosure
To reveal Blocker B, a throwaway image `voyant-op-probe` added ONE symlink
(`/app/node_modules/tsx` → existing store copy). No application code, no repo
file, and no deployed package content was modified. Image discarded on cleanup.
