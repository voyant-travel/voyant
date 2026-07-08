# Managed profile admin host — source-free admin UI serving

- **Status:** Plan (2026-07-08)
- **Tracks:** voyant#3044 · Parent: voyant#2983 · Sibling: voyant#2987 (API runtime entry, shipped)
- **Related:** Packaged Admin RFC (#1643/#1649), `@voyant-travel/vite-config`, platform#953/#954

## Problem

`loadManagedProfileRuntime` (`@voyant-travel/framework/managed-runtime`, #2987)
gives Cloud a **source-free API** runtime entry: it boots `createVoyantApp` from
a serialized profile snapshot with no `starters/operator` import. There is no
equivalent for the **admin UI**. To put the admin into
`voyant-operator-runtime:<framework-version>` (platform#954), Cloud must today
copy `starters/operator/src/*` (route tree, providers, TanStack Start server
entry, generated files) and its `vite.config.ts` (chunking + SSR config). That
copied build config is load-bearing and diverges — the exact
"copied-build-config-diverges" failure class the Packaged Admin RFC calls out
(module-init ordering: `Cannot read properties of undefined (reading
'createContext')`, SSR externalization interop breakage).

**Goal:** a framework-owned, source-free admin host Cloud can package next to
the API runtime entry, serving the standard admin (SSR + client assets) from
published packages + a profile snapshot, with **no** `starters/operator/src/*`
and **no** copied `vite.config.ts`.

## Naming: profile-agnostic, not "operator"-bound

The host is named for the **managed-profile** contract, not the `operator`
profile. `profile` is a field on the snapshot (`operator` today; a future PMS or
other product profile is just another value — Voyant is not a PMS, but a PMS
product would reuse this same managed-profile architecture from published
packages). The API side already models it this way — `loadManagedProfileRuntime`
/ `createManagedProfileApp`, keyed on the snapshot, never "operator" in an
identifier. This plan follows suit:

- **Package:** `@voyant-travel/admin-host` — a generic, profile-agnostic admin
  serving layer, sitting alongside the packaged admin surfaces (`admin`,
  `admin-app`, `admin-react`). **Not** `@voyant-travel/framework/operator-admin`
  and **not** `operator-admin-host` — no product/profile name in the package.
- **Factory:** `createManagedProfileAdmin(...)`, mirroring
  `createManagedProfileApp`. The profile is read from the snapshot.
- It stays a **dedicated package**, not folded into `@voyant-travel/framework`:
  the React SSR graph must not enter the framework's API-only cold-start closure
  (cf. #2915). Optionally re-exported lazily via a framework subpath.

## Current architecture (what's packaged vs starter-owned)

Packaged already (RFC #1649):

- **Surfaces** — `@voyant-travel/admin/app` (`createAdminRouter`,
  `attachAdminExtensionRoutes`, `buildAdminExtensionRoutes`, `AdminRootShell`,
  `AdminWorkspaceShell`), `@voyant-travel/admin-app`
  (`adminExtensionChildRoutes`, `adminExtensionRouteOptions`, `core-extension`),
  and per-domain pages under `@voyant-travel/<domain>-react/admin`.
- **Build config** — `@voyant-travel/vite-config` `voyantStartViteConfig(...)`
  owns vendor chunking (`manualChunks`), SSR `optimizeDeps`, the `@` alias, and
  dev-tunnel hosts. The starter `vite.config.ts` only instantiates plugins and
  adds the Node `ssr` target/`noExternal`/resolve-conditions.

Still starter-owned (blocks source-free):

| Piece | File(s) | Lines | Role |
|---|---|---|---|
| Route-tree codegen | `src/admin.routes.generated.tsx`, `src/admin.extensions.generated.ts`, `src/admin.destinations.generated.tsx` | ~1067+ | Code-assembled admin routes from packaged surfaces, **driven by `voyant.config` modules** — but referencing starter-local `@/lib/*` and `@/routes/_workspace`. |
| File-route shell | `src/routes/(auth)/*`, `src/routes/_workspace/route.tsx`, `src/routes/__root.tsx` → `src/routeTree.gen.ts` | ~610 | Admin app-shell + auth routes (storefront/pay/proposal routes are a **separate** concern — non-goal). |
| Router assembly | `src/router.tsx` | 73 | Merges file routes + generated extension routes + discovered local routes; typed-link merge. |
| SSR handler | `src/ssr-handler.ts` | 22 | `createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))`. |
| Start config | `src/start.ts` | 39 | `createStart({ defaultSsr:false })` + CSRF middleware. |
| Node host | `src/server.ts` | 193 | Static asset serving + `createNodeServer` boot + env/stores compose. |
| Fetch entry | `src/entry.ts` | 92 | `createWorkerFetch({ api, ssr: lazySsr(...) })` + scheduled. |
| Glue | `src/lib/*` (~30) | — | `env.getApiUrl`, `voyant-fetcher`, `admin-extensions` registry, `current-user`, i18n, observability. |

Key facts that shape the design:

1. **Codegen is already config-driven.** `voyant admin generate` emits the
   `admin.*.generated.*` files from the `voyant.config` `modules` list — which is
   exactly the profile snapshot's `modules`. Source-free = generate into a
   package (or at build time from the snapshot), not commit into starter `src`.
2. **The generated files' only starter coupling is the `@/lib/*` glue and
   `@/routes/_workspace` import.** If that glue is packaged (or injected), the
   generated tree is package-portable.
3. **SSR + Node host are thin** (`ssr-handler.ts` 22 lines, host boot in
   `server.ts`) and already lean on `@voyant-travel/runtime`
   (`createWorkerFetch`, `lazySsr`, `createNodeServer`, `withActiveRouteSsrManifest`).
   The serving layer is a small, well-bounded extraction.
4. **The app-shell file-routes** (`_workspace`, `(auth)`, `__root`) are the one
   piece that is genuinely UI and must move into a package to be source-free.

## Target seam

Mirror `loadManagedProfileRuntime`. A framework-owned host composes the packaged
surfaces for a snapshot and serves SSR + client assets in the same Node process
as `/api`:

```ts
// @voyant-travel/admin-host
import { createManagedProfileAdmin } from "@voyant-travel/admin-host"

const admin = createManagedProfileAdmin({
  project,                 // parsed profile snapshot (its `profile`+`modules` drive the subset)
  apiBaseUrl: "/api",      // API served by loadManagedProfileRuntime (#2987)
  clientAssetsDir,         // built client bundle
})
// admin.fetch(request, env, ctx)  -> SSR + static assets
// admin.router  / admin.ssrHandler for embedding
```

The load-bearing vite/route-tree/SSR config ships with the package; a Cloud
image needs no copied `vite.config.ts`, route tree, providers, or server entry.

## Phased plan

### Phase 1 — Admin host serving seam (router + SSR + Node static host)

Package the **serving** layer that is currently `router.tsx` + `ssr-handler.ts` +
the static-serving/host half of `server.ts`, as `@voyant-travel/admin-host` the
starter adopts. Does **not** yet move the file-route shell or make codegen
source-free — it proves the seam and shrinks host glue.

- New package `@voyant-travel/admin-host`:
  - `createManagedProfileAdminRouter({ routeTree, apiBaseUrl, fetcher, extensions })`
    — wraps `createAdminRouter` + `attachAdminExtensionRoutes`, taking the glue
    (fetcher, api-url, extensions registry) as **injected options** instead of
    `@/lib/*` imports.
  - `createManagedProfileAdminSsrHandler()` — the `createStartHandler(...)` wrap.
  - `serveManagedProfileAdmin({ clientAssetsDir })` — the Hono static-serving +
    SSR fall-through (`web` in `server.ts`), returning a `fetch`.
- Starter adopts: `router.tsx`/`ssr-handler.ts` shrink to a call into the
  package passing the still-local generated tree + glue.
- **Acceptance:** operator builds + serves admin unchanged; `router.tsx` +
  `ssr-handler.ts` no longer contain host logic (only wiring); package unit +
  SSR smoke test (render the document shell for `/`).

### Phase 2 — Packaged app-shell routes + generated route map as a build artifact

Move the admin app-shell (`__root`, `_workspace/route`, `(auth)/*`) into a
package. Crucially, the **profile-specific generated route map is a build
artifact derived from the snapshot — not a published npm package of
tenant/profile-specific generated files.** The reusable *shell* and *host* live
in packages; the *route map* is emitted per build.

- **Shell in a package.** New `@voyant-travel/admin-app/shell` (or extend
  `admin-app`) exporting `__root`/`_workspace`/auth route definitions as
  factories parametrized by injected glue (fetcher, api-url, auth seam).
- **Auth as a capability seam, not baked.** Define a profile-agnostic
  `ManagedProfileAdminAuthRuntime` — `getCurrentUser`, `signIn`, `signOut`,
  `invite`/`reset`, cookie-forwarding fetch — and feed it through the existing
  `createAdminWorkspaceBeforeLoad({ getCurrentUser })` seam
  (`packages/admin/src/app/workspace.tsx:59`). Do **not** bake `lib/auth.ts` /
  Better Auth into the shell: managed Cloud auth and self-host auth each
  implement the seam.
- **Codegen: own it, then dual-mode it.** First locate/own the
  `voyant admin generate` CLI (not found under obvious local paths — treated as
  CLI-owned today). Keep **starter-local** generation for self-host; add a
  **managed** mode that emits the profile route map into a scratch build
  directory (or a Vite virtual-module namespace — no virtual-module precedent
  in-repo yet), derived from the snapshot `modules` (ties to #2107 subsetting —
  excluded modules contribute no route/extension). Update
  `scripts/check-admin-composition-drift.mjs` to understand both outputs.
- **Typed links stay first-class generated exports.** The generated module
  exports the profile-specific `AdminExtensionRoutesBy*` maps; the **host
  package** provides the merge helper (the `MergeRouteTypeMaps` /
  `_addFileTypes` contract in `router.tsx:22`). The typed-link contract for
  package-delivered pages must survive the boundary intact.
- **Glue in a package.** `createManagedProfileAdminRuntime({ apiBaseUrl })`
  provides the isomorphic fetcher (cookie-forwarding SSR variant) + env, so
  `getApiUrl`/`voyant-fetcher` are no longer starter-local.
- **Acceptance:** a fixture composes the full admin route tree from packages +
  a snapshot with **zero** `src/routes/**` and **zero** `@/lib/*` (the generated
  map living in a scratch build dir, not a committed/published file); typed links
  preserved; the starter still works by consuming the packaged shell + local
  generation.

### Phase 3 — Framework-owned build entry (no copied vite config)

Provide a build path that produces the admin client + SSR bundle from packages +
a snapshot, with no starter `vite.config.ts` copy.

- Extend `@voyant-travel/vite-config` with a `voyantManagedProfileAdminViteConfig(...)`
  that bundles the Node `ssr` target/`noExternal`/resolve-conditions currently in
  the starter `vite.config.ts`, and points the TanStack Start route source at the
  packaged shell (Phase 2).
- A thin, profile-agnostic build entry (config + `index.html` + client/server
  entry) Cloud copies **verbatim** (or a generator emits) — carrying no app
  logic, only the packaged config instantiation.
- **Acceptance:** `createManagedProfileAdmin` end-to-end — a build in a scratch
  dir with only published packages + a snapshot + the thin entry produces
  `dist/client` + `dist/server`, and `node server.js` serves SSR admin + `/api`
  in one process. No `starters/operator/src/*` in the build graph.
- **SSR-manifest acceptance is a test, not a theory.** `withActiveRouteSsrManifest`
  restricts preloads to active routes; the scratch-admin build must **prove**
  chunk/preload selection still maps to the generated route tree. Smoke: build
  the scratch admin, render several SSR routes asserting no missing
  preload/module errors, and open it in a browser (chrome-devtools) asserting
  clean hydration — no `createContext`/`.create`-on-undefined console errors —
  plus `/api/health` 200.

## Ownership split (who owns what)

- `@voyant-travel/admin` (`/app`, components) — admin **UI primitives** (router
  factory, root/workspace shells, nav, widget slots).
- `@voyant-travel/admin-app` (`/shell`) — the **app-shell routes**
  (`__root`/`_workspace`/`(auth)`), as glue-injected factories.
- `@voyant-travel/admin-host` — **SSR + static + Node serving** and the
  typed-link merge helper (`createManagedProfileAdmin` and friends).
- `@voyant-travel/vite-config` — **build config** (chunking, SSR target,
  optimizeDeps).
- **Generated route map** — a **profile build artifact** derived from the
  snapshot (scratch dir / virtual module), owned by the `voyant admin generate`
  codegen, *not* a published package.

## Risks / open questions

- **Framework server-graph weight.** The React SSR graph must stay out of
  `@voyant-travel/framework`'s API-only startup closure (cf. #2915) — hence the
  dedicated `@voyant-travel/admin-host` package (depending on the admin
  surfaces), consumed lazily like `entry.ts`'s `lazySsr` today. `framework` may
  expose a tiny lazy adapter later, but the SSR dependency owner is the host
  package, never a static `framework` subpath.
- **App-shell routes are genuinely UI + auth.** `_workspace`/`(auth)` carry
  auth-client wiring (Better Auth). Phase 2 injects a
  `ManagedProfileAdminAuthRuntime` capability through the existing
  `createAdminWorkspaceBeforeLoad({ getCurrentUser })` seam
  (`packages/admin/src/app/workspace.tsx:59`) — it does **not** bake the
  starter's `lib/auth.ts`. Managed Cloud auth and self-host auth each implement
  the seam.
- **Codegen home.** Confirm where `voyant admin generate` lives and retarget its
  output package + glue imports (Phase 2). Keep `check-admin-composition-drift`
  green.
- **Typed links across the package boundary.** The `AdminExtensionRoutesBy*`
  typed-link merge in `router.tsx` must survive the move (Phase 2) — export the
  generated type maps from the package.
- **SSR manifest.** `withActiveRouteSsrManifest` restricts preloads to active
  routes; verify it composes from the packaged route tree (Phase 3 build).

## Non-goals (per #3044)

- Storefront/site bundling — separate Cloud apps consuming the Voyant API.
- Source-backed custom admin pages/widgets — the deployment-local `src/admin/*`
  extension path stays for self-host; managed profiles use the packaged set.
- Removing self-host/starter usage — the starter remains the reference for
  source-backed/self-host and is the first consumer of each phase's package.
