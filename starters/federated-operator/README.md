# Federated Operator Starter

`starters/federated-operator` is the starter for deployments that use Voyant as
the operating layer around existing systems before moving domains natively into
Voyant.

Use this starter when an external system remains authoritative for one or more
domains and Voyant should provide the admin workspace, automation runtime,
agent/action controls, sync health, provenance visibility, and mirrored records.
Use `starters/operator` when Voyant is the native all-in-one operator system with
authoritative inventory, bookings, finance, storefront, and operational modules.

## Included Modules

This starter intentionally keeps the runtime small for the first mirrored-CRM
tracer:

- `@voyant-travel/action-ledger`: ledger, idempotency, approval, and external
  write control surface.
- `@voyant-travel/relationships`: mirrored people and organizations.
- `@voyant-travel/identity`: shared addresses and contact points.
- `@voyant-travel/workflow-runs`: app-level workflow/run observability routes.

It intentionally excludes native inventory, catalog, bookings, finance,
storefront, operations, notifications, legal, trips, flights, and vertical
modules. Add them only when the deployment chooses a native source-of-truth mode
for that domain or a replacement capability-port spike proves the dependency.

## Admin Surface

The first admin shell contains:

- Dashboard: deployment posture and minimum runtime summary.
- Source Connections: placeholder for source-connection and sync-health slices.
- People and Organizations: Relationships admin pages for mirrored CRM records.
- Workflow Runs: passive run visibility for integration daemons and workflows.
- Action Ledger: audit/control surface for tool and external-write actions.
- Settings: placeholder for authority, auth, and deployment controls.

The Source Connections route is deliberately a placeholder. The shared source
connection schema, encrypted secret references, cursors, rate-limit state, and
disconnect behavior are tracked by follow-up implementation issues.

## Local Development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SESSION_CLAIMS_SECRET`, and
   `INTERNAL_API_KEY`.
3. Run migrations with `pnpm --filter federated-operator db:migrate`.
4. Start the app with `pnpm --filter federated-operator dev`.
5. Open `http://localhost:3310`.

The first local user signs up through Better Auth and becomes the single-tenant
admin. Verification OTPs are logged by the shared auth package when no email
provider is configured.

## Adoption Path

Start in federated mode with source-owned data mirrored into Voyant. Promote a
domain to native Voyant ownership only after the source-of-truth mode, edit
authority, provenance, sync health, and conflict behavior are explicit for that
domain.
