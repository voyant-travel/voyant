# packaged-acceptance hydration failure — diagnosis (issue #4233)

## Summary

`pageerror: Cannot read properties of undefined (reading 'get')` at hydration is
**reproduced**. The crash is `router.stores.ids.get()` in TanStack Start's
`hydrateStart`, where `router.stores.ids` is `undefined`.

Root cause: the packaged starter pins `@tanstack/react-router` (via
`standard-node-starter.json` coordinates) and Vite dedupes the client to that
copy, but it lets the rest of the **TanStack Start toolchain float freely** in
the test's isolated app install. When the float crosses an upstream release that
**renamed the router store field `matchesId` → `ids`**, the floated hydration
harness (`@tanstack/start-client-core`) reads `router.stores.ids` off a router
that the pinned/deduped `@tanstack/router-core` built with the *old* field name.
Field is undefined → `.get()` throws → hydration never completes → the probe
never sets `hydrated` → `waitForFunction` times out.

The "version-only repo diff" between the passing and failing commits is a red
herring: the trigger is an external npm publish that landed in the CI window.

## The actual stack (deliverable #1)

`voyant develop` (unminified) — names the module + symbol + line directly:

```
pageerror: Cannot read properties of undefined (reading 'get')
TypeError: Cannot read properties of undefined (reading 'get')
    at hydrateStart (.../@tanstack+start-client-core@1.170.15/node_modules/@tanstack/start-client-core/dist/esm/client/hydrateStart.js:27:25)
```
Vite dev source link resolves the frame to
`@tanstack/start-client-core/src/client/hydrateStart.ts:55:25`:

```ts
// hydrateStart.ts:55
if (!router.stores.ids.get().length) {   // <-- router.stores.ids is undefined
  await hydrate(router)
}
```

`voyant start` (production, minified) — same call, confirmed by the built chunk:

```
pageerror: Cannot read properties of undefined (reading 'get')
    at nn (http://127.0.0.1:<port>/assets/index-x-lM0s1k.js:1:23782)
```
`index-x-lM0s1k.js` contains, verbatim:
`...serializationAdapters:t}),e.stores.ids.get().length||await Ce(e)`
(`e` = router, `Ce` = `hydrate`) — the minified `hydrateStart`. Production and
dev crash at the identical `router.stores.ids.get()` line. (No `.map` is emitted
for the production client bundle, so the frame was mapped by grepping the chunk.)

## Why `router.stores.ids` is undefined — the field rename

`@tanstack/start-client-core` `hydrateStart` across the pass/crash boundary:

| start-client-core | hydrateStart line 27 (dist) |
|---|---|
| `1.170.14` (passing float) | `if (!router.stores.matchesId.get().length) await hydrate(router)` |
| `1.170.15` (crashing float) | `if (!router.stores.ids.get().length) await hydrate(router)` |

The router the app builds is the Vite-deduped `@tanstack/react-router@1.170.17`
→ `@tanstack/router-core@1.171.14`, whose `router.stores` has **`matchesId`, not
`ids`** (router-core grew a dedicated `stores.js` exposing `ids` only by
`1.171.16`). So:

- `start-client-core@1.170.14` reads `router.stores.matchesId` → present on the
  `1.171.14` router → **works**.
- `start-client-core@1.170.15` reads `router.stores.ids` → **undefined** on the
  `1.171.14` router → **throws**.

Duplication alone is not sufficient to crash (my first run had two router-core
copies, `1.171.14` + `1.171.15`, and passed). The crash needs the harness to
adopt the renamed `ids` field while the pinned/deduped router still exposes
`matchesId`.

## Corrected timeline (supersedes the earlier 1.168.16 claim)

`@tanstack/react-start-client` hard-pins its router/harness versions:

| react-start-client | react-router | router-core | start-client-core | published (UTC) |
|---|---|---|---|---|
| 1.168.15 | 1.170.17 | 1.171.14 | 1.170.13/14 | 2026-07-01 |
| 1.168.16 | 1.170.18 | 1.171.15 | **1.170.14** (`matchesId`) | 2026-07-13 |
| 1.168.17 | 1.170.19 | 1.171.16 | **1.170.15** (`ids`) | **2026-08-04T20:35:44Z** |

CI bisection window (UTC): `9a10fa57a` committed `2026-08-04T20:15:47Z` (PASSED),
`d738daf55` committed `2026-08-04T20:32:12Z` (FAILED). `1.168.16` was already
`latest` three weeks before the passing run, so it cannot be the trigger. The
publish that straddles the window is **`1.168.17`, ~3 minutes after the release
commit** — its `start-client-core@1.170.15` is the first with the `ids` rename.
That is why the repo diff is version fields only, yet main fails reproducibly:
the failing edge is an upstream npm publish, not a source change.

My earlier local run could not reproduce because pnpm served **stale registry
metadata** and installed `react-start-client@1.168.16` (→ `start-client-core@1.170.14`,
still `matchesId`), i.e. the pre-failure float state — which is also why it
passed with the duplicate pair present.

## Reproduction (what I did)

Naturally floated (not forced): cleared pnpm's registry metadata cache
(`rm -rf ~/.cache/pnpm/metadata ~/.cache/pnpm/metadata-v1.3
~/.cache/pnpm/metadata-ff-v1.3 ~/.cache/pnpm/v11/metadata`), then ran the test
unchanged. The isolated app install (`--prefer-offline`, no app lockfile) then
floated `@tanstack/react-start` to `1.168.36` → `react-start-client@1.168.17` →
`start-client-core@1.170.15`. Verified the installed versions before trusting the
result; no `pnpm.overrides` were used to force the toolchain. Result: **5/5
subtests fail**, both `start` and `develop`, with the stack above.

Because `1.168.17` is now `latest`, a plain `node --test
scripts/tests/minimal-starter-acceptance.test.mjs` on a fresh-metadata machine
now reproduces the CI failure.

## Duplicate set in the crashing (1.168.17) install (deliverable #5)

All under `<app>/node_modules/.pnpm/`:

| package | versions present |
|---|---|
| `@tanstack/react-router` | `1.170.17` (app pin, Vite-deduped for client) **and** `1.170.19` (toolchain) |
| `@tanstack/router-core` | `1.171.14` (from react-router 1.170.17) **and** `1.171.16` (from react-router 1.170.19) |
| `@tanstack/start-client-core` | `1.170.15` (single — the hydration harness) |
| `@tanstack/react-start` | `1.168.36` (single) |
| `@tanstack/react-start-client` | `1.168.17` (single) |
| `@tanstack/history` | `1.162.0` (single) |

`react`, `react-dom`, `@tanstack/react-query` are single copies (fine). No
`@voyant-travel/*` package is duplicated — the test's `pnpm.overrides` pin those
to `file:` archives regardless of version, so the earlier "@voyant duplicate"
hypothesis is disproved.

## Recommended fix (not applied — see rationale)

The defect is that the starter pins `@tanstack/react-router` but lets the
TanStack Start hydration toolchain (`@tanstack/react-start*`,
`@tanstack/start-client-core`, `@tanstack/router-core`, …) float independently,
so a floated harness runs against a pinned, older router with a different store
field name. Fix by pinning the **whole `@tanstack/*` router+start family
coherently** so the harness and the router always come from one release train:

1. **(recommended, durable)** In `scripts/package-starters.mjs`, emit
   `pnpm.overrides` for the entire TanStack router/start family
   (`@tanstack/react-router`, `@tanstack/router-core`, `@tanstack/router-plugin`,
   `@tanstack/router-generator`, `@tanstack/router-utils`,
   `@tanstack/react-start`, `@tanstack/react-start-client`,
   `@tanstack/react-start-server`, `@tanstack/react-start-rsc`,
   `@tanstack/start-client-core`, `@tanstack/start-server-core`,
   `@tanstack/history`) locked to the versions the workspace lockfile resolves
   (the coherent set the release was built and tested against). Derive them from
   the workspace so the coordinate can't drift out of the family again. This
   removes the split install entirely; its effect (single copy per package,
   matching harness/router) is verifiable with the reproduction above.
2. Alternatively, bump the starter `@tanstack/react-router` coordinate so the app
   router is built by the same release train the toolchain floats to (e.g.
   `1.170.19` → router-core `1.171.16`, which has `ids`). This is tail-chasing:
   the float will drift again on the next TanStack publish.

### Why not committed here

Per the task ("fix only if clear-cut"; "a precise diagnosis with evidence is
worth more than a speculative fix"), and because option 1 is a starter-generation
design change that pins a dozen third-party versions and should be owned/reviewed
by the runtime team, the deliverable is the verified diagnosis + a reproduction
recipe so any candidate fix can be checked. Option 2 is a stop-gap, not a fix.

## Instrumentation left on the branch (in the test file)

- `page.on("pageerror")` records `error.stack` alongside `error.message` — this is
  what surfaced the `hydrateStart` frame above.
- `VOYANT_KEEP_ARTIFACTS=1` retains the packed/installed/built fixture at
  `$TMPDIR/voyant-minimal-starter-acceptance-keep` for `node_modules` inspection.
  Default runs are unchanged.
