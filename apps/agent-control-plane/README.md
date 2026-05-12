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
- `POST /api/dispatch-intents/latest`
- `GET /api/dispatch-intents/active?repository=<owner/name>&issue=<number>&action=<name>`
- `POST /api/dispatch-intents/:id/finish`
- `POST /api/tick-snapshots`
- `GET /api/tick-snapshots/latest?repository=<owner/name>`
- `GET /api/tick-snapshots/recent?repository=<owner/name>&limit=<n>`

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

`POST /api/dispatch-intents/latest` accepts
`{ repository, filters?, options?, lease: { holder, ttlSeconds? } }`, loads the
latest stored tick snapshot, selects the next dispatchable plan, and persists a
leased dispatch intent. It still does not execute the command. The lease holder
is an operator, supervisor, or runner identifier; the TTL defaults to 900
seconds and must be between 60 and 3600 seconds. If a non-expired intent already
exists for the same repository, issue, and action, the endpoint returns
`dispatch_intent_already_active`.

`GET /api/dispatch-intents/active` reads the active-pointer record for one
repository, issue, and lifecycle action. It returns `{ active, intent }`, where
`active` is false when the stored pointer is expired or terminal. Use this to
explain lease contention before rerunning or releasing work; it does not mutate
the lease.

`POST /api/dispatch-intents/:id/finish` accepts
`{ holder, status, reason?, exitCode? }` where `status` is `completed`,
`failed`, or `released`. The holder must match the lease holder. Finishing an
intent writes a terminal record and updates the active pointer when it still
points at that lease, allowing the next supervisor lease to proceed without
waiting for TTL expiry.

`POST /api/tick-snapshots` accepts the JSON emitted by
`pnpm agent:queue:tick -- --json`, validates the shape, and returns the accepted
snapshot with counts for total recommendations, dispatchable recommendations,
and recent events. If the Worker has an `AGENT_TICK_SNAPSHOTS` R2 binding, it
stores both the latest snapshot for that repository and a timestamped history
record.

`GET /api/tick-snapshots/latest?repository=<owner/name>` reads the latest stored
snapshot for one repository. It returns
`tick_snapshot_storage_not_configured` when R2 is not bound, and
`tick_snapshot_not_found` before the first snapshot is submitted.

`GET /api/tick-snapshots/recent?repository=<owner/name>&limit=<n>` returns
recent stored snapshots for one repository. `limit` defaults to 20 and is
clamped to 1..50.

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

Request the next plan from the latest stored snapshot with:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:plan-dispatch -- --repo voyantjs/voyant
```

Use `--json` when a supervisor needs the response shape directly. Use `--issue`,
`--action`, `--event-log`, and `--update-body` to pass through the same filters
and command options as `POST /api/dispatch-plans/latest`.

Inspect recent stored snapshots with:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:history -- --source control-plane --repo voyantjs/voyant
```

Create a leased dispatch intent from the latest stored snapshot with:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:lease-dispatch -- --repo voyantjs/voyant --holder supervisor:local
```

This records the lease and prints the command to run. It does not execute the
command.

Inspect an active lease when a supervisor reports lease contention:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:active-dispatch -- --repo voyantjs/voyant --issue 579 --action remote-bootstrap
```

Validate deployed control-plane and runner capabilities before enabling Cron:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
AGENT_RUNNER_URL=https://agent-runner.example.workers.dev \
AGENT_RUNNER_TOKEN=... \
pnpm agent:queue:deployment-doctor -- --json
```

The doctor calls both `/api/capabilities` endpoints, reads
`/api/supervisor/status` from the runner app, and reports persistence and
execution mode without printing token values.
After a queue snapshot exists, add `--smoke-tick --repo voyantjs/voyant` to
verify that the deployed runner can call `POST /api/dispatch-plans/latest`
through its dry-run supervisor tick without leasing work.

Finish the leased dispatch intent after the runner has handled the printed
command:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:finish-dispatch -- --intent intent_579 --holder supervisor:local --status completed
```

Release an expired active dispatch intent without copying its holder manually:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:release-dispatch -- --issue 579 --action sync-pr --repo voyantjs/voyant
```

Run the full local supervisor path for one dispatchable item:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:run-dispatch-intent -- --repo voyantjs/voyant --holder supervisor:local --yes
```

This leases the next intent, validates that the leased command is an allowed
`pnpm agent:queue:*` lifecycle command, executes it locally, then records
`completed` or `failed` on the dispatch intent.

Run a bounded supervisor loop against the control plane with:

```bash
AGENT_CONTROL_PLANE_URL=https://agent-control-plane.example.workers.dev \
AGENT_CONTROL_PLANE_TOKEN=... \
pnpm agent:queue:control-plane-loop -- --repo voyantjs/voyant --holder supervisor:local --iterations 3 --yes
```

Each iteration submits a fresh tick snapshot, leases one dispatch intent from
that stored snapshot, executes the leased command, and records the terminal
outcome before continuing. The loop stops when no dispatchable intent is
available, a command fails, or the iteration limit is reached.

## Optional R2 Storage

Bind an R2 bucket as `AGENT_TICK_SNAPSHOTS` to keep the latest accepted tick
snapshot plus recent snapshot history per repository:

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

Bind an R2 bucket as `AGENT_DISPATCH_INTENTS` to persist leased dispatch
intents. Set `AGENT_DISPATCH_INTENT_KEY_PREFIX` when multiple environments
share one bucket. The same physical R2 bucket can be bound under both names if
the key prefixes are distinct.
