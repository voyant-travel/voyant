# Voyant Workflows Monorepo Migration Plan

This document defines the migration path for merging the current
`voyant-workflows` repository into the main `voyant` monorepo.

The goal is not only to copy code. The goal is to end with:

- one repository
- one `voyant` CLI
- one shared shadcn-based UI system
- Voyant Workflows as the default runtime in first-party templates and apps
- runtime replaceability preserved through an explicit adapter boundary

This plan assumes:

- neither repo is in production yet
- `voyant-workflows` already works end-to-end
- a short period of internal churn is acceptable if it reduces long-term
  architectural debt

## Decision

Merge `voyant-workflows` into `voyant`.

Do not preserve it as a parallel long-lived repo with a shared CLI.
That would create one product with two release trains, two ownership surfaces,
and one binary that still has to coordinate cross-repo changes.

## Non-goals

This migration does **not** mean:

- domain packages in `@voyantjs/*` should directly depend on the concrete
  orchestrator implementation
- Hatchet or other runtimes must become impossible
- every workflows repo path should be imported unchanged

The monorepo should merge code ownership, not collapse architectural
boundaries.

## Target End State

### Product shape

- `voyant` remains the main repo
- `@voyantjs/cli` remains the only CLI package and still provides the
  `voyant` binary
- Voyant Workflows becomes the default first-party runtime for templates and
  examples
- alternative runtimes stay possible through adapter wiring in apps/templates

### Architectural boundary

The main repo should distinguish:

- framework contracts and domain packages
- the default first-party workflows runtime implementation
- optional runtime adapters

The important rule is:

Domain packages should depend on execution contracts, not on the concrete
orchestrator or local dashboard server.

## Recommended Package Layout

### Keep as framework packages

- `packages/core`
- `packages/db`
- domain packages like `bookings`, `finance`, `legal`, `products`, etc.
- `packages/cli`
- `packages/ui`
- `packages/typescript-config`

### Add as workflows runtime packages

- `packages/workflows`
- `packages/workflows-react`
- `packages/workflows-config`
- `packages/workflows-errors`
- `packages/workflows-bindings`
- `packages/workflows-orchestrator`
- `packages/workflows-orchestrator-cloudflare`
- `packages/workflows-orchestrator-node`

### Add as workflows runtime apps

- `apps/workflows-local-dashboard`
- `apps/workflows-orchestrator-worker`
- `apps/workflows-selfhost-cloudflare-worker`
- `apps/workflows-selfhost-node-server`
- `apps/workflows-tenant-worker`

### Do not keep as separate packages

- workflows repo `apps/cli`
- workflows repo `packages/ui`
- workflows repo `packages/typescript-config`

Those three should be merged into the main repo equivalents rather than carried
as parallel packages.

## Naming Strategy

Because the workflows repo is not yet in production, prefer one cleanup rename
instead of preserving temporary naming debt.

### Recommended package names

| Current in `voyant-workflows` | Target in `voyant` |
| --- | --- |
| `@voyant/workflows` | `@voyantjs/workflows` |
| `@voyant/workflows-react` | `@voyantjs/workflows-react` |
| `@voyant/config` | `@voyantjs/workflows/config` |
| `@voyant/errors` | `@voyantjs/workflows/errors` |
| `@voyant/bindings` | `@voyantjs/workflows/bindings` |
| `@voyant/orchestrator` | `@voyantjs/workflows-orchestrator` |
| `@voyant/orchestrator-cloudflare` | `@voyantjs/workflows-orchestrator-cloudflare` |
| `@voyant/orchestrator-node` | `@voyantjs/workflows-orchestrator-node` |
| `@voyant/cli` | merge into `@voyantjs/cli` |
| `@voyant/ui` | merge into `@voyantjs/ui` |
| `@voyant/tsconfig` | merge into `@voyantjs/voyant-typescript-config` |

Reasoning:

- one scope is cleaner than mixed `@voyant/*` and `@voyantjs/*`
- `config`, `errors`, and `bindings` are too generic to live in the monorepo
  without the `workflows-` prefix
- the CLI should not split by product

## Migration Strategy

Use a **vendor first, normalize immediately after** approach.

That means:

1. import the working code from `voyant-workflows` with as little logic change
   as possible
2. adapt paths, names, UI, and CLI inside the same migration branch before the
   merged code is considered canonical

This is safer than trying to redesign everything before import, and cleaner
than carrying a long-lived half-merged state.

## Phase 0: Freeze the Merge Surface

Create a short freeze window while the merge branch is underway.

During this phase:

- stop making non-essential structural changes in both repos
- decide the import commit from `voyant-workflows`
- decide whether history preservation matters

### History choice

If history matters, use `git subtree add` into a temporary prefix.

If history does not matter, use a plain file copy. Given current status, a
plain copy is acceptable.

Recommended default:

- preserve history only if it is cheap
- do not block the merge on git archaeology

## Phase 1: Raw Import Into a Temporary Prefix

Import the workflows repo into a temporary staging area inside `voyant`.

Recommended temporary prefix:

- `internal/workflows-import/`

Copy into that prefix:

- `packages/*`
- `apps/*`
- `docs/*`
- `examples/*`
- root-level files that are still useful for reference

Do **not** wire the temporary import into the workspace.

This phase is for source capture and diff review only.

### Why use a temporary prefix first

- avoids immediate path collisions with `apps/cli` and `packages/ui`
- makes it easy to diff and selectively promote code
- prevents a broken workspace while names are still in flux

## Phase 2: Promote Runtime Packages and Apps Into Canonical Paths

Move code out of `internal/workflows-import/` into the target paths.

Promote these packages directly:

- `packages/workflows`
- `packages/workflows-react`
- `packages/workflows-config`
- `packages/workflows-errors`
- `packages/workflows-bindings`
- `packages/workflows-orchestrator`
- `packages/workflows-orchestrator-cloudflare`
- `packages/workflows-orchestrator-node`

Promote these apps directly:

- `apps/workflows-local-dashboard`
- `apps/workflows-orchestrator-worker`
- `apps/workflows-selfhost-cloudflare-worker`
- `apps/workflows-selfhost-node-server`
- `apps/workflows-tenant-worker`

Do not promote:

- `apps/cli` as a standalone app
- `packages/ui` as a standalone package
- `packages/typescript-config` as a standalone package

## Phase 3: Normalize Package Names and Imports

Rename package identities immediately after promotion.

Tasks:

- change all imported package names to the `@voyantjs/*` targets listed above
- rename internal references in source, tests, READMEs, and examples
- update repository URLs in imported `package.json` files
- align imported packages with the main repo license strategy where needed

At the end of this phase:

- no canonical package in the monorepo should still reference
  `https://github.com/voyant-cloud/voyant-workflows`
- no code that is meant to stay should import `@voyant/*`

## Phase 4: Merge the CLI

The workflows CLI should not survive as a separate package.

Instead, fold its command surface into `packages/cli`.

### Merge strategy

Keep:

- current `@voyantjs/cli`
- current `voyant` binary entry

Add:

- `voyant dev`
- `voyant workflows build`
- `voyant workflows manifest`
- `voyant workflows serve`
- `voyant workflows list`
- `voyant workflows run`
- `voyant workflows runs`
- `voyant workflows run-detail`
- `voyant workflows replay`
- `voyant workflows trigger`
- `voyant workflows prune`
- `voyant workflows tail`

### Recommended implementation approach

1. copy the workflows CLI command modules into `packages/cli/src/commands/workflows/*`
2. copy shared helpers into `packages/cli/src/lib/workflows/*`
3. extend the current top-level dispatcher in `packages/cli/src/index.ts`
4. keep the existing framework commands untouched while adding the workflows
   tree beside them

### Important rule

Do not replace the existing CLI package with the workflows CLI package.

The right move is additive merge into `@voyantjs/cli`, not package swap.

## Phase 5: Unify UI

The workflows repo `packages/ui` should not be kept as a second UI package.

Use `packages/ui` in the main repo as the canonical UI surface.

### Merge strategy

1. diff the component sets between the two repos
2. add any missing primitives needed by the workflows dashboard into the main
   repo `packages/ui`
3. adapt the workflows dashboard app to import from `@voyantjs/ui`
4. delete the imported workflows `packages/ui` copy

### Important rule

Avoid a long-lived state where both of these exist:

- `@voyantjs/ui`
- a second workflows-only UI package

If the dashboard truly needs dashboard-specific presentation helpers, create a
small app-local component layer inside `apps/workflows-local-dashboard`, not a
second design-system package.

## Phase 6: Unify TypeScript and Tooling

The imported workflows repo uses a separate TS config package and slightly
different workspace tooling.

Normalize onto the main repo tooling:

- root `pnpm-workspace.yaml`
- root `turbo.json`
- root `pnpm` version
- root linting and formatting strategy
- `@voyantjs/voyant-typescript-config`

Tasks:

- port any genuinely useful TS presets from workflows into the main repo
  `packages/typescript-config`
- remove imported workflows TS config package
- update all imported package references
- align scripts with the main repo conventions

## Phase 7: Default Runtime Wiring In Templates and Apps

Once packages, CLI, and UI are merged, switch first-party apps and templates to
Voyant Workflows as the default runtime.

### What “default” means

- new templates should scaffold with Voyant Workflows wiring by default
- examples should demonstrate Voyant Workflows first
- app shells should assume Voyant Workflows unless explicitly configured
  otherwise

### What “replaceable” means

- runtime choice stays at the app/template wiring layer
- domain packages do not import the concrete orchestrator packages
- alternative runtimes can still be plugged in by changing runtime adapters

### Concretely

Add an execution adapter contract if needed, then have:

- default adapter backed by Voyant Workflows
- optional adapter backed by Hatchet or another runtime

This can live in a small explicit surface such as:

- `packages/core/src/execution/*`
- or `packages/execution/*`

The exact folder matters less than the dependency direction:

- domain code points toward the contract
- apps/templates point from the contract to a concrete runtime

## Phase 8: Replace Hatchet In First-Party Apps

Current first-party app/template workers still use Hatchet directly.

Migration order:

1. `apps/dev`
2. `templates/dmc`
3. `templates/operator`

For each:

- replace direct Hatchet workflow/task definitions with the Voyant Workflows
  authoring surface
- keep business logic calls unchanged
- preserve cron behavior
- preserve reminder, PDF, and background delivery behavior

Only remove `@hatchet-dev/typescript-sdk` once all first-party runtime wiring
is switched.

## Phase 9: Documentation and Release Cleanup

After code is merged and wired:

- update root README to make Voyant Workflows the default first-party runtime
- update template READMEs and setup docs
- document how to swap to a different runtime
- delete or archive the old `voyant-workflows` repo
- redirect contributors to the main monorepo

## Recommended Order of Execution

This is the lowest-risk order.

1. create merge branch in `voyant`
2. import `voyant-workflows` into `internal/workflows-import/`
3. promote runtime packages/apps into canonical paths
4. rename package identities and imports
5. merge workflows CLI into `packages/cli`
6. merge workflows UI needs into `packages/ui`
7. normalize TS config, pnpm, turbo, linting
8. make templates/apps default to Voyant Workflows
9. replace Hatchet in first-party apps/templates
10. update docs and delete the old repo

## Big-Bang vs Two-Step

Given current status, prefer a **controlled big-bang merge** rather than a
prolonged dual-repo bridge.

That means:

- one branch
- one import
- one round of renames
- one CLI merge
- one UI merge

The only thing that should be staged over a little time is the runtime wiring
inside templates and apps. Everything else should be normalized quickly so you
do not accumulate temporary compatibility layers.

## Immediate Next Action

The next implementation task should be:

1. create the merge branch in `voyant`
2. copy `voyant-workflows` into `internal/workflows-import/`
3. produce a mechanical promotion map from imported paths to target paths
4. start with package renames before touching business logic

If the branch is kept disciplined, the merge can be done without preserving any
user-facing compatibility debt because there are no production consumers yet.
