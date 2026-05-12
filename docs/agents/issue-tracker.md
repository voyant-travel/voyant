# Issue Tracker

Voyant uses GitHub Issues and GitHub Projects for agent work.

The maintainer-controlled project is:

```text
Voyant Engineering
```

## Rules

- Issue reporting can remain open.
- Agent execution is gated by maintainers.
- A task is executable only when:
  - label `agent:ready` is present
  - Project field `Agent State = Ready`
  - Project field `Maintainer Approved = Yes`
  - the issue body contains a non-empty `Agent Brief` section
- Triage agents may draft recommendations and briefs, but must not set the
  final execution gate.

## Project Automation

Repository workflow `.github/workflows/agent-project-intake.yml` adds issues to
the Project only after the maintainer-applied `agent:ready` label is present.

Required repository configuration:

- variable `VOYANT_ENGINEERING_PROJECT_URL`:
  `https://github.com/orgs/voyantjs/projects/<project-number>`
- secret `ADD_TO_PROJECT_PAT`: a GitHub App token, classic PAT, or fine-grained
  PAT with Projects write access. For the pilot, a fine-grained PAT needs
  organization Projects `read & write`, repository Issues `read-only`, and
  repository Pull requests `read-only`. A classic PAT needs `project`, plus
  `repo` if the repository is private.

GitHub's default `GITHUB_TOKEN` is repository-scoped and is not enough for
organization Projects v2 automation.

The intake workflow only adds eligible issues to the Project. Maintainers still
set `Agent State = Ready` and `Maintainer Approved = Yes` in the Project, and
ensure the issue body has an `Agent Brief`, before the runner may execute work.

## GitHub CLI

Use `gh` from inside the repository.

Common operations:

```bash
gh issue view <number> --comments
gh issue list --state open --json number,title,labels,updatedAt
gh issue comment <number> --body-file <file>
gh issue edit <number> --add-label agent:ready
```

Prefer the GitHub app/connector for project metadata when available. Use `gh`
or GraphQL when thread-level state or ProjectV2 fields are needed.

## Runner Dry Run

All runner commands support `--help` and `-h`. When invoked through `pnpm`, pass
runner flags after `--`:

```bash
pnpm agent:queue:status -- --help
```

Before operating the queue, run the read-only doctor:

```bash
pnpm agent:queue:doctor
```

Doctor mode checks GitHub CLI authentication, current repository detection,
Project visibility, required Project fields/options, and queue visibility. It
does not mutate GitHub, create worktrees, or spend agent execution budget. Pass
`--json` for automation.

Queue readers scan all Project pages by default. `--limit` controls the
GraphQL page size, not the total number of items scanned.

The runner treats a missing or empty `Agent Brief` issue-body section as a hard
execution gate failure. Draft briefs may start in comments, but the approved
brief must be copied into the issue body before `Agent State = Ready`.

Pure queue helper coverage lives in `pnpm agent:queue:test`. Keep tests there
for argument parsing, gate evaluation, repository scoping, and pagination before
adding live GitHub-dependent cases.

Before any agent execution is enabled, use the read-only queue runner:

```bash
pnpm agent:queue:dry-run
```

The dry run reads `Voyant Engineering`, checks the execution gate, and prints
the branch, workspace, and execution-plan path it would use. It must not create
branches, worktrees, comments, PRs, or Project updates.

When the dry run shows an approved item, prepare the local workspace with:

```bash
pnpm agent:queue:prepare -- --issue <number> --yes
```

Prepare mode checks the same execution gate, creates a local worktree under
`.agent-worktrees/`, creates the execution plan in that worktree, and stops.
It must not run an implementation agent, push a branch, open a PR, comment on
GitHub, or update Project fields.

By default, prepare mode only selects Project items for the current checkout's
`origin` repository. Organization Projects can contain issues from multiple
repositories with the same issue number. Pass `--repo <owner/name>` only when
preparing work for a different repository intentionally.

For unattended runner flows, use `start` to combine workspace preparation and
Project claiming in one guarded command:

```bash
pnpm agent:queue:start -- --issue <number> --yes
```

Start mode checks the same execution gate, creates the local worktree and
execution plan, then updates the Project item to `Agent State = Planning`.
It still does not run an implementation agent, push a branch, open a PR, or
publish evidence.

The `Workspace` Project field is typed by convention. Local runner commands use
`.agent-worktrees/<issue-number>-<slug>`. Future remote adapters use
`sandbox:<provider>:<id>` and must not be interpreted as local filesystem
paths. Cleanup only removes local worktrees under `.agent-worktrees/`.
Until the remote adapter is implemented, local-only commands such as
`run-command`, `capture-browser`, `handoff`, `publish-evidence`, and `open-pr`
reject `sandbox:` workspace references instead of resolving them as paths.
Use `pnpm agent:queue:remote-inspect -- --issue <number>` to inspect a remote
workspace reference and confirm whether its provider adapter is configured.
Remote adapter config is intentionally explicit: pass
`--adapter-config <path>`, set `VOYANT_AGENT_REMOTE_ADAPTER_CONFIG`, or commit a
trusted `.agents/remote-workspaces.mjs` config on the runner branch. The module
should export `remoteWorkspaceAdapters` or a default adapter map keyed by
provider name. Use `.agents/remote-workspaces.example.mjs` as the local template
for enabling the CLI-backed Sprite adapter.

When a remote adapter declares command execution, maintainers can run a guarded
one-shot command without updating Project state:

```bash
pnpm agent:queue:remote-exec -- --workspace sandbox:sprite:<id> --command "pwd" --yes
```

This is an adapter validation tool, not the full implementation runner. It does
not write evidence, open PRs, collect browser artifacts, or perform cleanup.

Use `remote-bootstrap` to clone or update the repository inside the remote
workspace before running real commands:

```bash
pnpm agent:queue:remote-bootstrap -- --workspace sandbox:sprite:<id> --repo voyantjs/voyant --branch feature/123-task --yes
```

For issue-scoped work, `--issue <number>` derives the branch from the execution
plan. The command creates a deterministic remote repo directory by default,
fails if that directory exists but is not a Git repository, fetches origin, and
checks out the existing task branch or creates it from the selected base ref.
After a successful issue-scoped bootstrap, it updates the Project item to
`Agent State = Planning`, stores the remote `Workspace`, stores the planned
branch, and refreshes `Last Heartbeat`. Direct `--workspace` validation without
an issue remains non-Project-mutating.

After remote bootstrap, run a supervised provider-neutral command in the remote
repository directory:

```bash
pnpm agent:queue:remote-run-command -- --issue <number> --command "pnpm verify:fast" --yes
```

Remote-run-command mode requires a `sandbox:<provider>:<id>` workspace in
`Planning`, `Running`, `Changes Requested`, or `CI Repair` unless `--force` is
passed. It moves the item to `Running`, streams stdout/stderr through the
adapter, writes a remote transcript under `.agent-runs/`, writes an evidence
packet under `docs/agent-evidence/active/`, then moves the item to
`Human Review` on exit code `0` or `Blocked` on nonzero exit. It does not push
branches, expose HTTP, capture browser artifacts, publish evidence, open PRs,
or clean up the remote workspace.
For UI-labeled work, pass `--ui-evidence` with the browser evidence text from
`remote-capture-browser`. Successful remote commands validate local
`.agent-runs/remote-browser/.../summary.json` artifacts before moving to review;
blocking console or request issues keep the Project item in `Blocked` unless a
maintainer explicitly passes `--allow-browser-issues`.

Use a named remote process when a UI verification flow needs a long-running
server before browser capture:

```bash
pnpm agent:queue:remote-capture-browser -- --issue <number> --dev-server-command "pnpm dev" --port 3000 --yes
```

With `--dev-server-command`, remote-capture-browser starts a named remote
process, exposes the requested port, captures browser evidence from the local
runner, then stops the process even when capture fails. It stores process
metadata, the command, the PID, process-group marker, and logs under remote
`.agent-runs/remote-processes/<name>/`. It refuses to replace an already
running process with the same name, waits briefly, then fails with the remote
log tail if startup exits early.

For manual debugging, use the standalone process commands around browser
capture:

```bash
pnpm agent:queue:remote-start-process -- --issue <number> --name dev-server --command "pnpm dev" --port 3000 --yes
pnpm agent:queue:remote-capture-browser -- --issue <number> --port 3000 --yes
pnpm agent:queue:remote-process-status -- --issue <number> --name dev-server
pnpm agent:queue:remote-stop-process -- --issue <number> --name dev-server --yes
```

Remote-stop-process mode is idempotent: stale or missing PID files are treated
as already stopped, while live processes get a graceful terminate before a
forced kill. These process commands do not mutate Project state; use them as
setup and teardown around browser evidence capture.
Remote-process-status is read-only and reports PID liveness, stored metadata,
and a bounded remote log tail for debugging a running or failed dev server.

For UI work in a remote workspace, expose the running remote dev server and
capture browser evidence from the local runner:

```bash
pnpm agent:queue:remote-capture-browser -- --issue <number> --port 3000 --yes
pnpm agent:queue:remote-capture-browser -- --issue <number> --url "https://preview.example.test" --publish-artifacts --yes
```

Remote-capture-browser mode requires a `sandbox:<provider>:<id>` workspace. With
`--port`, it calls the adapter's `exposeHttp` operation and captures the
returned URL with Playwright. With `--url`, it skips adapter exposure and
captures the supplied URL. With `--dev-server-command`, it also requires
adapter command execution so the runner can start and stop the remote server
for the capture. Artifacts are written under local `.agent-runs/` so remote
browser proof does not dirty the task branch; pass `--publish-artifacts` to
upload screenshots, videos, logs, summaries, and the artifact index to
configured object storage. Use the printed browser evidence text as
`--ui-evidence` for the supervised command that writes the final evidence
packet. Providers that do not declare the required adapter capabilities fail
closed.

Queue tick recommends this remote browser command for UI-labeled remote work
that is in review or repair without browser proof. It intentionally leaves
`<dev-server-command>` and `<port>` as maintainer-filled placeholders, so
dispatch does not run it unattended.

After a successful remote command, publish the remote evidence packet to GitHub
or configured R2-compatible object storage:

```bash
pnpm agent:queue:remote-publish-evidence -- --issue <number> --yes
pnpm agent:queue:remote-publish-evidence -- --issue <number> --publish-artifacts --yes
```

Remote-publish-evidence mode reads the relative Evidence path from the remote
repository directory through the configured adapter, posts or reuses a GitHub
issue comment, optionally uploads the packet to configured object storage, and
updates the Project `Evidence` field to the durable URL. It refuses absolute or
escaping evidence paths and refuses Evidence values that already point at a
remote URL.

After remote evidence is published, push the remote branch and open or reuse a
draft PR:

```bash
pnpm agent:queue:remote-open-pr -- --issue <number> --yes
pnpm agent:queue:remote-open-pr -- --issue <number> --ready --yes
```

Remote-open-pr mode requires the same handoff states as local `open-pr` unless
`--force` is passed. It verifies the remote repository is on the expected
branch, refuses uncommitted remote changes unless `--allow-dirty` is passed,
pushes the branch through the configured adapter, creates or reuses the PR from
the local GitHub token, and updates the Project `PR` field after the PR URL is
known.

After a remote-backed issue is merged, abandoned, or explicitly force-cleaned,
dispose the remote workspace through the configured adapter:

```bash
pnpm agent:queue:remote-cleanup -- --issue <number> --yes
```

Remote-cleanup mode requires `Agent State = Done` or `Abandoned` unless
`--force` is passed. It calls the adapter's `dispose` operation and clears the
Project `Workspace` field only after that operation succeeds. Providers that do
not declare `dispose` fail closed.

After local start, run a supervised provider-neutral command in the claimed
workspace:

```bash
pnpm agent:queue:run-command -- --issue <number> --command "pnpm verify:fast" --yes
```

Run-command mode requires an existing claimed workspace in `Planning`,
`Running`, `Changes Requested`, or `CI Repair` unless `--force` is passed. It
moves the item to `Running`, streams stdout/stderr to the terminal and a local
ignored transcript under `.agent-runs/`, writes an evidence packet inside the
workspace, then moves the item to `Human Review` on exit code `0` or `Blocked`
on nonzero exit. The command receives `VOYANT_AGENT_*` environment variables
for the issue, branch, workspace, plan path, evidence path, log path, repository,
verification lane, workspace descriptor, and browser artifact location.
Successful UI-labeled runs must pass `--ui-evidence <text>` or they are blocked
instead of moved to `Human Review`; nonzero exits are still blocked by the
command failure. It does not push branches, open PRs, or publish evidence
comments.

For UI work, capture browser evidence before handoff or before a successful
`run-command` transition:

```bash
pnpm agent:queue:capture-browser -- --issue <number> --dev-server-command "pnpm dev" --yes
```

Capture-browser mode writes screenshots, video, console logs, failed-request
logs, and a summary under `docs/agent-evidence/browser/...` inside the claimed
workspace. By default it targets the deterministic issue URL in
`VOYANT_AGENT_DEV_SERVER_URL`; pass `--url` for an already-running app or a
specific route. Use `--viewports 1440x900,390x844` to capture desktop and
mobile evidence in the same artifact packet. The summary classifies console
errors, console warnings, failed HTTP responses, and failed requests so review
does not require opening raw JSONL logs first. For UI-labeled work, capture
fails after writing artifacts when the summary contains console errors, failed
requests, or malformed log lines; pass `--allow-browser-issues` only when a
maintainer accepts a documented exception. The command prints a multi-line
value that can be passed as `--ui-evidence` to `handoff` or `run-command`.
When `handoff` or successful `run-command` receives a local browser artifact
reference, it reads the artifact `summary.json` and blocks handoff if that
summary still contains blocking browser issues unless `--allow-browser-issues`
is used with a maintainer-approved exception.
Evidence packets expand that local browser summary into a review index with
repo-relative screenshot, video, console-log, failed-request-log, and summary
links so PR reviewers do not need to decode raw runner output.

Use the read-only status view to inspect the current queue and active work:

```bash
pnpm agent:queue:status
```

Status mode scans all Project pages for the current repository and reports
ready, active, stale, blocked, human-review, and merge-ready items. Pass
`--json` for automation or `--max-age-days <number>` to adjust the heartbeat
staleness threshold. It also tails recent JSONL runner events from
`.agent-runs/events.jsonl`; pass `--recent-events 0` to hide them or
`--event-log <path>` to inspect a different audit log. For UI-labeled work,
status distinguishes browser artifact references from generic transcript or
evidence fields so active runs do not hide missing browser capture.

Use the local event timeline when a maintainer or supervisor needs more than
the short status tail:

```bash
pnpm agent:queue:events -- --issue <number>
```

Events mode reads `.agent-runs/events.jsonl` and prints a filterable timeline.
Use `--type <event>` to narrow to one event type, `--limit <number>` to control
the printed event count, `--scan-limit <number>` to scan a larger recent tail
before filtering, `--event-log <path>` for a different local ledger, and
`--json` for dashboard or process-manager consumers. The timeline includes
queue recommendations, lifecycle mutations, supervised command exits, browser
capture summaries, CI evidence collection, evidence publication, PR sync/open
events, and cleanup events.

Use the read-only tick view when wiring an always-on supervisor:

```bash
pnpm agent:queue:tick
```

Tick mode scans the same repository-scoped Project queue and prints ordered
action recommendations such as `start`, `run-command`, `capture-browser`,
`collect-ci`, `publish-evidence`, `open-pr`, `sync-pr`, `cleanup`, or
`inspect-stale`. It does not mutate GitHub, create worktrees, run commands,
publish evidence, or
open PRs. Pass `--json` when a process manager or future control plane needs
machine-readable actions. Tick also tails recent JSONL runner events from
`.agent-runs/events.jsonl`; pass `--recent-events 0` to hide them or
`--event-log <path>` to inspect a different local ledger. `Merge Ready` items
with linked PRs keep recommending `sync-pr` so the runner can observe
maintainer merges and mark the item done.
The Cloudflare-ready control-plane app can accept this JSON at
`POST /api/tick-snapshots` for validation and summary counts. When the
control-plane Worker has an R2 binding, it also stores the latest accepted
snapshot per repository for dashboard and supervisor reads. This still does not
dispatch work.
Use `pnpm agent:queue:submit-tick` with `AGENT_CONTROL_PLANE_URL` and
`AGENT_CONTROL_PLANE_TOKEN` to submit a fresh snapshot. For replayable
supervisor tests, write `pnpm agent:queue:tick -- --json` to a file and submit
it with `pnpm agent:queue:submit-tick -- --input <path>`.
`CI Repair` items with failing linked PRs recommend `collect-ci` until a local
CI repair packet exists. Ready items with `sandbox:<provider>:<id>` workspaces
recommend `remote-bootstrap` so dispatch can clone/fetch the repository and
move the item to `Planning`. Remote workspace items in `Planning`,
`Changes Requested`, or `CI Repair` recommend `remote-run-command`, but dispatch
does not execute implementation commands automatically. Remote `Human Review`
items with local evidence paths recommend `remote-publish-evidence`; after
evidence is published, they recommend `remote-open-pr`. Later remote workspace
states still recommend explicit wait or manual evidence steps. Terminal remote
items recommend `remote-cleanup`. Malformed reserved `sandbox:` values recommend
`inspect-workspace`.

Use dispatch to execute one allow-listed tick recommendation:

```bash
pnpm agent:queue:dispatch -- --yes
```

Dispatch mode re-reads the Project, selects the highest-priority dispatchable
recommendation, and runs one lifecycle command. It is dry-run by default. Pass
`--issue <number>` or `--action <name>` to narrow selection. Dispatch can run
`start`, `remote-bootstrap`, `remote-publish-evidence`, `remote-open-pr`,
`remote-cleanup`, `collect-ci`, `publish-evidence`, `open-pr`, `sync-pr`, and
`cleanup`; it refuses `run-command`, `remote-run-command`, `capture-browser`,
`inspect-stale`, blocked work, and wait states so
implementation and browser execution remain explicit.
Successful dispatch attempts append local JSONL audit events to
`.agent-runs/events.jsonl` by default; pass `--event-log <path>` when a
supervisor needs a different local ledger path. The same path is passed to the
nested lifecycle command so dispatch and lifecycle events stay in one ledger.

Use loop for a bounded supervisor pass:

```bash
pnpm agent:queue:loop -- --iterations 3 --yes
```

Loop mode repeatedly re-reads the Project, dispatches one allow-listed
recommendation, then sleeps before the next iteration. It is dry-run by default
and capped at 100 iterations. It uses the same dispatch allow-list, so it cannot
run implementation commands or override blocked/wait states. Each iteration is
recorded in the local event log, alongside the nested dispatch command's own
events, so unattended queue passes have a minimal timeline. Audit writes are
best-effort and do not block lifecycle work if the local event log cannot be
written.

After a workspace is prepared, claim the item before implementation work starts:

```bash
pnpm agent:queue:claim -- --issue <number> --yes
```

Claim mode checks the same execution gate, then updates GitHub Project fields:

- `Status = In Progress`
- `Agent State = Planning`
- `Branch = <planned branch>`
- `Workspace = <planned workspace>`
- `Last Heartbeat = <today>`

Successful mutating runner commands append local JSONL audit events to
`.agent-runs/events.jsonl` by default. This includes `claim`, `start`,
`heartbeat`, `run-command`, `capture-browser`, `collect-ci`,
`publish-evidence`, `open-pr`, `sync-pr`, `complete-pr`, `cleanup`, `release`,
and their remote execution/evidence/PR/cleanup counterparts. Pass
`--event-log <path>` when a supervisor needs a different local ledger path.

While work is claimed, refresh the item heartbeat or state:

```bash
pnpm agent:queue:heartbeat -- --issue <number> --state Running --yes
```

Heartbeat mode updates `Last Heartbeat` and can move `Agent State` among
`Planning`, `Running`, `Blocked`, `Human Review`, `Changes Requested`, and
`CI Repair`. Blocked heartbeats require `--blocked-by` or `--reason`. Passing
`--evidence <url-or-path>` updates the `Evidence` field. `Human Review`
heartbeats require `--evidence`. When the state is not `Blocked`, heartbeat
clears `Blocked By`.

When work is ready for maintainer review, write the evidence packet and hand
off the Project item:

```bash
pnpm agent:queue:handoff -- --issue <number> --summary "..." --verification "pnpm lint:changed: passed" --yes
```

Handoff mode writes a markdown evidence packet under the task workspace,
updates `Evidence` with that path, sets `Agent State = Human Review`, updates
`Last Heartbeat`, and clears `Blocked By`. It requires `--summary` and
`--verification` so maintainer review always has a concrete packet.
For issues labeled `ui`, `ui-change`, `frontend`, `browser:evidence`, or
`needs-browser-evidence`, handoff also requires `--ui-evidence` unless
`--force` is used with an accepted exception.

Supervised commands receive browser artifact environment variables so UI work
can keep screenshots, videos, console logs, and failed-request logs in a stable
per-workspace location:

- `VOYANT_AGENT_DEV_SERVER_PORT`
- `VOYANT_AGENT_DEV_SERVER_URL`
- `VOYANT_AGENT_BROWSER_ARTIFACT_DIR`
- `VOYANT_AGENT_BROWSER_ARTIFACT_REFERENCE`

Publish the evidence packet when it should survive beyond the local workspace:

```bash
pnpm agent:queue:publish-evidence -- --issue <number> --yes
```

Publish mode reads the evidence packet from the task workspace, posts it as a
GitHub issue comment, updates `Evidence` with the comment URL, and refreshes
`Last Heartbeat`. It refuses remote Evidence URLs so it does not duplicate an
already-published packet.

After evidence exists and the branch is committed cleanly, publish the branch
for maintainer review:

```bash
pnpm agent:queue:open-pr -- --issue <number> --yes
```

Open-PR mode requires evidence, checks that the workspace is on the expected
branch, refuses dirty workspaces by default, pushes the branch, opens or reuses
a draft PR, updates the Project `PR` field, and refreshes `Last Heartbeat`.
It does not merge the PR or mark work merge-ready.

After a PR exists, sync its review/check status back into the Project:

```bash
pnpm agent:queue:sync-pr -- --issue <number> --yes
```

Sync-PR mode reads the linked PR and its check rollup. Failing checks move the
item to `Agent State = CI Repair`, requested changes move it to
`Changes Requested`, pending checks or draft PRs keep it in `Human Review`, and
passing non-draft PRs move it to `Merge Ready`. If the linked PR has already
been merged by a maintainer, sync-pr marks the Project item `Done`. It updates
`Status`, `PR`, `Last Heartbeat`, and `Blocked By`; it does not merge the PR.

When a linked PR has failing checks, collect local CI repair context before
running the fix:

```bash
pnpm agent:queue:collect-ci -- --issue <number> --yes
```

Collect-CI mode reads failed PR checks, fetches failed GitHub Actions log
snippets, writes a local repair packet under ignored `.agent-runs/...`, updates
`Evidence` to that local packet, and keeps the item in `CI Repair`. Raw CI logs
stay local; publish only redacted summaries when needed.

The next repair command receives the packet through
`VOYANT_AGENT_CI_REPAIR_EVIDENCE_PATH` and
`VOYANT_AGENT_CI_REPAIR_EVIDENCE_REFERENCE`. Keep the command narrow: diagnose
from that packet, change only the failing surface, and rerun the smallest
verification lane that covers the failure.

After a maintainer merges the PR, mark the Project item complete:

```bash
pnpm agent:queue:complete-pr -- --issue <number> --yes
```

Complete-PR mode requires the linked PR to be in GitHub's merged state, then
sets `Status = Done`, `Agent State = Done`, refreshes `PR` and
`Last Heartbeat`, and clears `Blocked By`. It does not merge PRs, delete
branches, or remove local worktrees.

After a completed or abandoned item no longer needs its local workspace, clean
up the worktree:

```bash
pnpm agent:queue:cleanup -- --issue <number> --yes
```

Cleanup mode removes the local worktree under `.agent-worktrees/`, clears the
Project `Workspace` field, and refreshes `Last Heartbeat`. It only runs for
`Agent State = Done` or `Abandoned` unless `--force` is passed. It does not
delete local branches, remote branches, PRs, evidence, or plans. Cleanup is
rerunnable: if the Project item still points at a workspace that is already
gone, it clears the stale Project field and treats local removal as complete.

Use the watchdog to find claimed work that has stopped reporting heartbeats:

```bash
pnpm agent:queue:watchdog
```

Watchdog mode is read-only. It reports items in active agent states with a
missing or stale `Last Heartbeat`. The default stale threshold is one day; pass
`--max-age-days <number>` to adjust it.

If a claimed item should return to the executable queue without shipping work,
release it:

```bash
pnpm agent:queue:release -- --issue <number> --reason "Released without implementation" --yes
```

Release mode updates `Agent State = Ready`, resets `Status = Todo`, updates
`Last Heartbeat` and `Evidence`, and clears `Branch`, `Workspace`, and
`Blocked By`. It refuses to release closed issues or items outside the expected
claimed states unless `--force` is passed.
