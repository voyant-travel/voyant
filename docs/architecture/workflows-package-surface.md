# Workflows Package Surface

Voyant keeps workflows public package names small and role-based. New
workflows packages must pass the deletion test: deleting the package should
move meaningful implementation complexity behind an existing interface, not
only remove release-cohort overhead.

## Public Packages

These workflow packages are intentionally public:

| Package | Role |
| --- | --- |
| `@voyant-travel/workflows` | Authoring SDK and workflow runtime subpaths. Includes `@voyant-travel/workflows/client` for app-safe managed Cloud trigger/event forwarding without workflow definitions or runner internals. |
| `@voyant-travel/workflows-react` | React hooks and client helpers for workflow run inspection. |
| `@voyant-travel/workflows-react/ui` | Canonical importable workflow run admin UI. |
| `@voyant-travel/workflow-runs` | Operator observability module: schema, recorder, admin routes, and rerun/resume registry. |
| `@voyant-travel/workflows-orchestrator` | Transport-neutral orchestrator engine and compliance tests. |
| `@voyant-travel/workflows-orchestrator-cloudflare` | Legacy Cloudflare Worker/Durable Object adapter. Compatibility only; not the managed Cloud runtime. |
| `@voyant-travel/workflows-orchestrator-node` | Supported Node/Postgres self-host runtime primitives. |
| `@voyant-travel/workflows-cloud-adapter` | Legacy tenant-worker adapter for old Cloudflare workflow experiments. |
| `@voyant-travel/workflows-node-step-container` | Legacy standalone Node step-server artifact. Not used by the current managed Cloud runtime. |

## Managed Cloud Versus Self-Host Adapters

Managed Voyant Cloud uses a hosted Node workflow runtime. App/Worker bundles
import `@voyant-travel/workflows/client` and forward trigger/event calls to
Cloud; workflow definitions and Node/server-only dependencies live in a separate
workflow bundle that Cloud executes. Workflow releases are created by Cloud
deployment flows, not by deployed app runtimes.

The Cloudflare adapter packages remain self-host/legacy compatibility for
operators running their own workflow runtime. They should not be presented as
the managed Voyant Cloud execution model, and they should not grow a new
edge/node runtime split.

## Folded Subpaths

These formerly separate package concepts now live under `@voyant-travel/workflows`:

| Former package concept | Canonical import |
| --- | --- |
| Workflow errors wrapper | `@voyant-travel/workflows/errors` |
| Workflow config wrapper | `@voyant-travel/workflows/config` |
| Workflow bindings wrapper | `@voyant-travel/workflows/bindings` |

The old workflow runs UI wrapper is replaced by `@voyant-travel/workflows-react/ui`.
The workspace compatibility packages have been removed; do not reintroduce
them.

## `workflow-runs` Exception

`@voyant-travel/workflow-runs` remains public even though the name is singular. It
owns real implementation depth: Drizzle schema, route mounting, recorder logic,
workflow runner registration, and rerun/resume behavior. Folding it into
`@voyant-travel/workflows/runs` would make the authoring SDK depend on Hono, Drizzle,
and database schema concerns. That would reduce public package count by one but
make the main SDK less local and less reusable.

If that tradeoff changes, revisit this document first and move the module in
one release with a migration note.

## Guardrail

`pnpm verify:workflows-package-surface` checks the allowlist above and rejects
removed compatibility wrapper package names. A new public
`@voyant-travel/workflow*` package should update this document and the checker in
the same PR.
