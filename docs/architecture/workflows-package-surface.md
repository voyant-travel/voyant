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
| `@voyant-travel/workflows-orchestrator` | Orchestrator engine, compliance tests, and supported Node/Postgres self-host runtime primitives. |

## Managed Cloud Versus Self-Host Adapters

Managed Voyant Cloud uses a hosted Node workflow runtime. App/Worker bundles
import `@voyant-travel/workflows/client` and forward trigger/event calls to
Cloud; workflow definitions and Node/server-only dependencies live in a separate
workflow bundle that Cloud executes. Workflow releases are created by Cloud
deployment flows, not by deployed app runtimes.

Self-host workflow runtime work should use the orchestrator package. Managed
Cloud app bundles should use `@voyant-travel/workflows/client`; they do not
embed workflow definitions or runner internals.

## Folded Subpaths

These formerly separate package concepts now live under `@voyant-travel/workflows`:

| Former package concept | Canonical import |
| --- | --- |
| Workflow errors wrapper | `@voyant-travel/workflows/errors` |
| Workflow config wrapper | `@voyant-travel/workflows/config` |
| Workflow bindings wrapper | `@voyant-travel/workflows/bindings` |

The old workflow runs UI wrapper is replaced by `@voyant-travel/workflows-react/ui`.
The workspace compatibility packages and retired split-runner packages have
been removed; do not reintroduce them.

| Removed package concept | Replacement |
| --- | --- |
| Cloudflare Worker/Durable Object workflow adapter | Use `@voyant-travel/workflows-orchestrator` for self-host runtime work, or `@voyant-travel/workflows/client` for managed Cloud app forwarding. |
| Cloudflare tenant-worker adapter | Use `@voyant-travel/workflows/client` from app bundles and deploy workflow bundles to the managed Cloud runtime. |
| Separate Node orchestrator package | Use `@voyant-travel/workflows-orchestrator` directly. |
| Standalone external node step server | Use the Node self-host runtime in `@voyant-travel/workflows-orchestrator` or the managed Cloud Node runner. |

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
