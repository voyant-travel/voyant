# packaged-acceptance hydration failure — diagnosis (issue #4233)

## Summary

The reported `pageerror: Cannot read properties of undefined (reading 'get')`
hydration failure is **not caused by the repo diff** between the last-passing
commit `9a10fa57a` and the "failing" release commit `d738daf55`. That diff is
`@voyant-travel/*` version fields + CHANGELOGs only, none of which affect the
runtime graph. Both commits **pass** the acceptance test in a clean local build
(evidence below).

The real trigger is external: a floating install of the **TanStack Start
toolchain** in the test's isolated starter app, which pulls in a *second* copy
of `@tanstack/react-router` / `@tanstack/router-core` alongside the copy the
starter pins. Two `router-core` module instances in one client bundle means the
router context registry created by one instance is invisible to a hook from the
other → `.get` on an undefined context at hydration.

## Evidence

Clean full `pnpm build`, then `node --test scripts/tests/minimal-starter-acceptance.test.mjs`:

- `d738daf55` (HEAD, the "failing" commit): **5/5 pass**, incl. "hydrates the
  production client bundle without browser errors".
- `9a10fa57a` (last passing commit): **5/5 pass**.

So the failure does not reproduce from either commit's source in the current
environment. On a passing `start`-mode run the test asserts `browserErrors`
deep-equals `[]` (test line ~588), so the `pageerror` is *not* passive noise —
when it appears it is a real hydration crash, it is simply intermittent on top
of the duplicate-install condition.

### The duplicate

In the installed starter `node_modules` (retained via `VOYANT_KEEP_ARTIFACTS=1`):

| package | copies |
|---|---|
| `react`, `react-dom`, `@tanstack/react-query` | 1 each (fine) |
| `@tanstack/react-router` | **2** — `1.170.17` and `1.170.18` |
| `@tanstack/router-core` | **2** — `1.171.14` and `1.171.15` |

Resolution map:

- app root `@tanstack/react-router@1.170.17` → `router-core@1.171.14`  (= starter coordinate)
- `@tanstack/react-start@1.168.34`, `@tanstack/react-start-client@1.168.16`,
  `@tanstack/router-plugin@1.168.23` → `@tanstack/react-router@1.170.18` → `router-core@1.171.15`

The toolchain packages **hard-pin** their router:
`react-start-client@1.168.16` declares `@tanstack/react-router: "1.170.18"`
(exact) and `@tanstack/router-core: "1.171.15"` (exact); `router-plugin` needs
`^1.170.18`. `1.170.17` does **not** satisfy `^1.170.18`, so pnpm is *forced* to
keep both — this is a guaranteed two-copy install, not a dedupe accident.

### Why the version float, and why CI bisected to a repo commit

- The workspace's committed lockfile pins `@tanstack/react-start-client@1.168.15`,
  whose router pin is `1.170.17` / `1.171.14` — consistent with the starter
  coordinate. In-repo, everything is single-copy.
- The acceptance test installs the starter app with `--ignore-workspace` and
  `--config.frozen-lockfile=false` and **no app lockfile**, so it ignores the
  workspace pin and re-resolves the toolchain to the newest matching release —
  `react-start-client@1.168.16`, which hard-pins the newer `1.170.18` router.
- `1.168.16` is an upstream npm publish. It landed between the last passing CI
  run and the "failing" one, so CI's bisection window straddles the npm publish,
  not a repo change. Any commit re-run after that publish would fail the same way;
  any commit re-run before it would pass.

### Why Vite doesn't save it deterministically

`packages/vite-config/src/index.ts` dedupes `@tanstack/react-router` for the
client build (`VOYANT_DEDUPE_DEPENDENCIES`, line ~340) but **not**
`@tanstack/router-core`. `@tanstack/react-start` is force-bundled into the client
(`noExternal`, `TANSTACK_START_BUNDLED_PACKAGES`) and imports `router-core`
directly, so react-start drags `router-core@1.171.15` into the bundle while the
deduped `react-router` brings `router-core@1.171.14`. The router context
singleton lives in `router-core`, so the two instances split it. Whether this
crashes at hydration depends on chunk/hoist order, which is why it is
intermittent locally but reproduced in CI.

## Recommended fix (not applied — see below)

Options, most durable first:

1. **Stop the isolated app install from floating the TanStack Start toolchain.**
   Emit `pnpm.overrides` (or exact deps) in the generated starter
   (`scripts/package-starters.mjs` / `standard-node-starter.json`) pinning the
   whole Start toolchain (`@tanstack/react-start*`, `@tanstack/router-plugin`,
   `@tanstack/router-core`, `@tanstack/router-generator`, `@tanstack/router-utils`,
   `@tanstack/react-router`) to the workspace-locked versions, so a fresh install
   cannot jump to a newer react-start that hard-pins a newer router. This removes
   the two-copy install entirely.
2. **Dedupe `@tanstack/router-core` (and `@tanstack/history`) in the client
   bundle** the same way `@tanstack/react-router` already is, so a split install
   still collapses to one router runtime in the bundle. Lower blast radius but
   only masks the duplicate install rather than preventing it, and the
   `resolvableAppRootDependencies` gate would need to allow transitive-only
   singletons.
3. Keep the starter coordinate in lockstep with react-start's router pin. This is
   tail-chasing (the float will drift again) and is *not* recommended as the
   primary fix.

### Why no code fix is committed here

The task is to find the actual cause; a fix only if clear-cut. The actual cause
is an external npm publish, and the crash could not be reproduced locally (both
commits pass), so no candidate fix can be *verified against the failure*. Option
1 is the correct durable fix and its effect (a single `react-router` /
`router-core` copy in the install) is verifiable, but it is a starter-generation
design change that should be reviewed and owned by the runtime team rather than
slipped in under an unreproducible failure. The diagnosis + evidence is the
deliverable.

## Instrumentation left on the branch (in the test file)

- `page.on("pageerror")` now records `error.stack` alongside `error.message`, so
  the next time this reproduces the stack frame (and thus the offending module)
  is captured instead of just the message.
- `VOYANT_KEEP_ARTIFACTS=1` retains the packed/installed/built fixture at
  `$TMPDIR/voyant-minimal-starter-acceptance-keep` instead of deleting it, so the
  installed `node_modules` can be inspected for duplicate copies. Default runs are
  unchanged.
