# voyant#3994 — Cost of not inlining workspace packages: measurements

Measurement experiment. Host: lab1. pnpm 10.18.0, node 22 (node:22-slim), 12
CPUs, 13 GiB RAM + 4 GiB swap. All numbers below are **measured**, not inferred,
except where explicitly marked *(inferred)*.

## TL;DR verdict

Stopping the inlining is **not viable as a two-file change.** Two independent
hard blockers, both outside the two editable files:

1. **`pnpm deploy --prod --legacy` does not apply `publishConfig`.** It ships the
   workspace `package.json` verbatim — `exports` still points at `./src/*.ts` —
   and it honors `files: ["dist"]`, so it copies `dist/` but **not** `src/`. The
   deployed manifests therefore point at files that were never shipped. Every
   `@voyant-travel/*` import fails at runtime with `ERR_MODULE_NOT_FOUND`.
2. **`tsx` is pruned by `--prod`** but `dist/server/server.js` imports it (the
   runtime `tsImport` of generated `.ts`). The server dies at ESM link time
   before it resolves a single workspace package.

Neither is fixable in `packages/vite-config/src/index.ts` or
`starters/operator/Dockerfile` alone.

---

## 1. Baseline (main, inlining ON)

| Metric | Value |
|---|---|
| `docker build` wall clock | **2:34.67** (this run; the `pnpm install` layer was Docker-cached) |
| Prior recorded cold run | 2m38s — **confirmed** (2:34 with cached install ≈ 2:38 cold) |
| Image size | **1.5 GB** — confirmed |

Deployed tree (`/deploy/node_modules/@voyant-travel/*`, 31 packages): each dir
contains **only `README.md` + `package.json`** — no `src/`, no `dist/`. The
manifest `exports` point at `./src/index.ts`. It works only because Vite inlined
all their code into `server.js`, so nothing is imported from `node_modules` at
runtime. Evidence: `deployed-tree-baseline.txt`.

## 2. `pnpm build` (root `turbo build`) from clean state — measurement B

- **First attempt: FAILED.** `@voyant-travel/identity-react`'s `tsc -p
  tsconfig.build.json` died with `FATAL ERROR: Ineffective mark-compacts near
  heap limit — JavaScript heap out of memory` at ~2040 MB, i.e. the **default
  ~2 GB V8 old-space cap** (SIGABRT 134 → SIGSEGV 139). Host had ~10 GB free, so
  this is a **per-process heap default, not host exhaustion — reproducible
  anywhere.** Evidence: `workspace-build.log`.
  - Root cause: the repo `build` script is a bare `turbo build` with **no heap
    flag**, and package `build` scripts are inconsistent — `finance` sets
    `NODE_OPTIONS=--max-old-space-size=8192 tsc`, `identity-react` sets nothing.
    Inlining has always hidden this because the operator image never ran the
    per-package dist build.
- **With the mechanical workaround** (`NODE_OPTIONS=--max-old-space-size=8192
  pnpm build --concurrency=3`, capped to avoid host OOM): **SUCCEEDED in
  7m7s** (turbo `Time: 7m7.334s`; Docker step `#12 DONE 429.6s`). All ~109
  packages built.

So: `pnpm build` **does not succeed out of the box** — headline finding for B.
It succeeds only after raising the heap limit and capping concurrency.

## 3. Does `pnpm deploy --prod` resolve workspace packages to `dist` or `src`?

**Definitively: to `src` (publishConfig NOT applied).** Verified two ways:

- **Real image** (`deployed-tree.txt`): after `pnpm build`, each
  `@voyant-travel/*` now contains `dist/index.js` (present) — but `src/` is
  **absent** and `exports["."]` is still **`"./src/index.ts"`**.
- **Isolated pnpm repro** (2-package synthetic workspace, same
  exports/publishConfig/`files` shape):
  - `deploy --prod --legacy` → `exports: {".":"./src/index.ts"}`, src absent,
    dist present. **publishConfig ignored.** (Matches the real image exactly.)
  - `deploy --prod` (non-legacy) → refuses:
    `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` — pnpm v10 only deploys injected
    workspaces; it tells you to use `--legacy`. That's *why* the repo uses
    `--legacy`.

`publishConfig` is applied by `pnpm pack`/`publish`, **not** by `deploy`. So the
"machinery exists (107 pkgs declare publishConfig)" fact is real but it is the
**publish** path, and `deploy --legacy` never touches it.

## 4. Non-inlined image — build + how far it boots

| Metric | Value |
|---|---|
| `docker build` wall clock | **9:50.32** total |
| — `pnpm install` (#11) | 16.7s (store warm) |
| — `pnpm build` workspace (#12) | 429.6s (7m7s) |
| — `pnpm --filter operator build` (#13) | 12.2s |
| — `pnpm deploy --prod --legacy` (#14) | 72.4s |
| — image export (#16+#18) | ~48s |
| Image size | **1.58 GB** (vs 1.5 GB baseline — ~80 MB larger; workspace dist copied in) |

**Boot: dies at ESM link time. Never binds a port, never serves `/healthz`.**

Primary error (`boot.log`), from `node dist/server/server.js`:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx'
    imported from /app/dist/server/server.js
```

`tsx` is an operator **devDependency** (used for runtime `tsImport` of generated
`.ts`); `--prod` prunes it. This is a wall independent of the inlining change.

Bypassing tsx to test the inlining crux directly (probe in `boot.log`):

```
import('@voyant-travel/core')
 -> ERR_MODULE_NOT_FOUND: Cannot find module
    '/app/node_modules/@voyant-travel/core/src/index.ts'
require.resolve('@voyant-travel/core') -> MODULE_NOT_FOUND
```

Confirms blocker #1 at runtime: the deployed manifest points at `src/index.ts`,
only `dist/` was shipped.

Dockerfile iteration performed: added the full `pnpm build` step before the
operator build, and (to get past the OOM) raised the heap + capped concurrency.
Both are legitimate build-stage changes. I did **not** attempt to patch tsx or
the exports, because both require changes outside the two allowed files (operator
`package.json`, or a repo-wide `inject-workspace-packages` + a pack/publish step).

## 5. Verdict & cost

**Not viable as scoped.** To actually stop inlining you would need, at minimum:

- A packaging path that yields **dist-pointing manifests** in the deployed tree.
  `deploy --legacy` cannot do this. The realistic route is the **publish/pack
  path** (`pnpm pack` per package applies `publishConfig` → install the tarballs),
  or making every workspace `exports` point at `dist` (107-package source change),
  or an injected-deploy migration (`inject-workspace-packages=true` repo-wide).
- **`tsx` (and its `esbuild`) present at runtime**, i.e. moved to prod deps or the
  runtime `tsImport` path removed — an operator source change.
- A **heap-safe `turbo build`** (`--max-old-space-size` in the `build` lane, or
  fixed per-package scripts) so the dist build is green in CI.

**Cost per CI build of the extra `pnpm build`:** **~7 minutes** of added
wall-clock (429.6s measured, concurrency=3; faster with more parallelism but at
a RAM cost) plus ~16s install, for a build that today takes ~2.5 min. So roughly
**3.5–4× the current image build time**, and image ~80 MB larger. That is the
floor; it does not include the packaging rework above, which is the real cost.

## 6. Surprises

- **`pnpm deploy --legacy` copies `dist/` but leaves `exports` pointing at
  `src/`** — the worst of both: dead-weight dist shipped, manifest unusable.
  Easy to assume deploy "does the right thing"; it does not.
- **`pnpm build` isn't green today** — the default 2 GB V8 heap kills at least
  `identity-react`. Fully masked by inlining until you build dists.
- **tsx blocks boot before the inlining question is even reached.** The image
  can't run TS-at-runtime without a devDependency that `--prod` removes.

## Method honesty

- Ran (real): baseline build, deployed-tree inspection (baseline + noinline),
  `pnpm build` (both the failing and the workaround run), noinline image build,
  boot attempt + runtime resolution probe, and the isolated pnpm deploy repro.
- Baseline wall-clock had the install layer Docker-cached; the build/deploy/export
  were fresh, and 2:34 ≈ the prior 2:38 cold number.
- I did **not** get a clean-room boot past tsx (would need an out-of-scope app
  change). The tsx failure and the `@voyant-travel` resolution failure are both
  shown directly.
- Did not run a full `--no-cache` baseline (disk was at 88–95% throughout;
  avoided blowing it). Disk restored to the starting 12 GB / 88% at end; only my
  throwaway containers/images/network removed, pre-existing ones untouched.
</content>
</invoke>
