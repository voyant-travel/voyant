# Workflows Package Surface

Voyant keeps workflows public package names small and role-based. New
workflows packages must pass the deletion test: deleting the package should
move meaningful implementation complexity behind an existing interface, not
only remove release-train overhead.

## Public Packages

These workflow packages are intentionally public:

| Package | Role |
| --- | --- |
| `@voyantjs/workflows` | Authoring SDK and workflow runtime subpaths. |
| `@voyantjs/workflows-react` | React hooks and client helpers for workflow run inspection. |
| `@voyantjs/workflows-ui` | Canonical importable workflow run admin UI. |
| `@voyantjs/workflow-runs` | Operator observability module: schema, recorder, admin routes, and rerun/resume registry. |
| `@voyantjs/workflows-orchestrator` | Transport-neutral orchestrator engine and compliance tests. |
| `@voyantjs/workflows-orchestrator-cloudflare` | Cloudflare Worker/Durable Object adapter. |
| `@voyantjs/workflows-orchestrator-node` | Node/Docker/Postgres adapter primitives. |
| `@voyantjs/workflows-cloud-adapter` | Voyant Cloud tenant-worker adapter. |
| `@voyantjs/workflows-node-step-container` | Publishable Node step-runner container artifact. |

## Folded Subpaths

These formerly separate package concepts now live under `@voyantjs/workflows`:

| Old package | Canonical import |
| --- | --- |
| `@voyantjs/workflows-errors` | `@voyantjs/workflows/errors` |
| `@voyantjs/workflows-config` | `@voyantjs/workflows/config` |
| `@voyantjs/workflows-bindings` | `@voyantjs/workflows/bindings` |

`@voyantjs/workflow-runs-ui` is replaced by `@voyantjs/workflows-ui`. The old
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
