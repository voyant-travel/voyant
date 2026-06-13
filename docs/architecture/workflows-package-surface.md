# Workflows Package Surface

Voyant keeps workflows public package names small and role-based. New
workflows packages must pass the deletion test: deleting the package should
move meaningful implementation complexity behind an existing interface, not
only remove release-cohort overhead.

## Public Packages

These workflow packages are intentionally public:

| Package | Role |
| --- | --- |
| `@voyantjs/workflows` | Authoring SDK and workflow runtime subpaths. Includes `@voyantjs/workflows/client` for app-safe managed Cloud trigger/event forwarding without workflow definitions or runner internals. |
| `@voyantjs/workflows-react` | React hooks and client helpers for workflow run inspection. |
| `@voyantjs/workflows-react/ui` | Canonical importable workflow run admin UI. |
| `@voyantjs/workflow-runs` | Operator observability module: schema, recorder, admin routes, and rerun/resume registry. |
| `@voyantjs/workflows-orchestrator` | Transport-neutral orchestrator engine and compliance tests. |
| `@voyantjs/workflows-orchestrator-cloudflare` | Cloudflare Worker/Durable Object adapter. |
| `@voyantjs/workflows-orchestrator-node` | Node/Docker/Postgres adapter primitives. |
| `@voyantjs/workflows-cloud-adapter` | Voyant Cloud tenant-worker adapter. |
| `@voyantjs/workflows-node-step-container` | Publishable Node step-runner container artifact. |

## Managed Cloud Versus Self-Host Adapters

Managed Voyant Cloud uses a hosted workflow runtime. App/Worker bundles import
`@voyantjs/workflows/client` and forward trigger/event calls to Cloud; workflow
definitions and Node/server-only dependencies live in a separate workflow bundle
that Cloud executes. Workflow releases are created by Cloud deployment flows,
not by deployed app runtimes.

The Cloudflare adapter packages remain self-host/legacy compatibility for
operators running their own workflow runtime. They should not be presented as
the managed Voyant Cloud execution model.

## Folded Subpaths

These formerly separate package concepts now live under `@voyantjs/workflows`:

| Old package | Canonical import |
| --- | --- |
| `@voyantjs/workflows-errors` | `@voyantjs/workflows/errors` |
| `@voyantjs/workflows-config` | `@voyantjs/workflows/config` |
| `@voyantjs/workflows-bindings` | `@voyantjs/workflows/bindings` |

`@voyantjs/workflow-runs-ui` is replaced by `@voyantjs/workflows-react/ui`. The old
workspace package is private and exists only as a local compatibility wrapper
while repo references migrate.

## `workflow-runs` Exception

`@voyantjs/workflow-runs` remains public even though the name is singular. It
owns real implementation depth: Drizzle schema, route mounting, recorder logic,
workflow runner registration, and rerun/resume behavior. Folding it into
`@voyantjs/workflows/runs` would make the authoring SDK depend on Hono, Drizzle,
and database schema concerns. That would reduce public package count by one but
make the main SDK less local and less reusable.

If that tradeoff changes, revisit this document first and move the module in
one release with a migration note.

## Guardrail

`pnpm verify:workflows-package-surface` checks the allowlist above. A new public
`@voyantjs/workflow*` package should update this document and the checker in the
same PR.
