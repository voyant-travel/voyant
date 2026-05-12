# Voyant Agent Control Plane

Cloudflare-ready Hono Worker for supervised agent queue orchestration.

This app intentionally starts with a dry-run contract. It can answer health,
capability, dispatch-planning, and snapshot-state requests, but it does not
mutate GitHub, create workspaces, run provider commands, or spend agent budget.
Local runner scripts remain the execution boundary until authentication,
persistence, and worker-to-runner transport are designed.

`/health` is public. `/api/*` requires a bearer token from
`AGENT_CONTROL_PLANE_TOKENS`, a comma-separated secret value configured in the
deployment environment. If no token is configured, API routes fail closed with
`control_plane_auth_not_configured`.

## Local Commands

```bash
pnpm -C apps/agent-control-plane test
pnpm -C apps/agent-control-plane check-types
pnpm -C apps/agent-control-plane dev
```

## Endpoints

- `GET /health`
- `GET /api/capabilities`
- `POST /api/dispatch-plans`
- `POST /api/dispatch-plans/latest`
- `POST /api/tick-snapshots`
- `GET /api/tick-snapshots/latest?repository=<owner/name>`

`POST /api/dispatch-plans` accepts ordered queue recommendations and returns the
first dispatchable plan that matches the optional filters. It mirrors the local
runner allow-list: `start`, `remote-bootstrap`, `collect-ci`,
`publish-evidence`, `remote-publish-evidence`, `open-pr`, `remote-open-pr`,
`sync-pr`, `cleanup`, and `remote-cleanup`. Pass `options.eventLog` to keep the
planned lifecycle command on a supervisor-specific JSONL ledger. Pass
`options.updateBody = true` to include `--update-body` when the selected plan is
`sync-pr`; other actions ignore that option.

`POST /api/dispatch-plans/latest` accepts `{ repository, filters?, options? }`,
loads the latest stored tick snapshot for that repository, and returns the same
dispatch plan shape with source metadata. This is the supervisor-friendly path:
submit snapshots on one cadence, then ask for dispatch plans without reposting
the full queue payload.

`POST /api/tick-snapshots` accepts the JSON emitted by
`pnpm agent:queue:tick -- --json`, validates the shape, and returns the accepted
snapshot with counts for total recommendations, dispatchable recommendations,
and recent events. If the Worker has an `AGENT_TICK_SNAPSHOTS` R2 binding, it
also stores the latest snapshot for that repository.

`GET /api/tick-snapshots/latest?repository=<owner/name>` reads the latest stored
snapshot for one repository. It returns
`tick_snapshot_storage_not_configured` when R2 is not bound, and
`tick_snapshot_not_found` before the first snapshot is submitted.

Submit the current queue snapshot from the repo runner with:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:submit-tick
```

The same command can submit a saved tick JSON file:

```bash
pnpm agent:queue:tick -- --json > .agent-runs/tick.json
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:submit-tick -- --input .agent-runs/tick.json
```

## Optional R2 Storage

Bind an R2 bucket as `AGENT_TICK_SNAPSHOTS` to keep the latest accepted tick
snapshot per repository:

```jsonc
"r2_buckets": [
  {
    "binding": "AGENT_TICK_SNAPSHOTS",
    "bucket_name": "voyant-agent-control-plane"
  }
]
```

Set `AGENT_TICK_SNAPSHOT_KEY_PREFIX` when multiple environments share one
bucket.
