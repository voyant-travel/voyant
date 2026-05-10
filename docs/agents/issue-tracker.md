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
set `Agent State = Ready` and `Maintainer Approved = Yes` in the Project before
the runner may execute work.

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

Use the read-only status view to inspect the current queue and active work:

```bash
pnpm agent:queue:status
```

Status mode scans all Project pages for the current repository and reports
ready, active, stale, blocked, human-review, and merge-ready items. Pass
`--json` for automation or `--max-age-days <number>` to adjust the heartbeat
staleness threshold.

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
passing non-draft PRs move it to `Merge Ready`. It updates `PR`,
`Last Heartbeat`, and `Blocked By`; it does not merge the PR.

After a maintainer merges the PR, mark the Project item complete:

```bash
pnpm agent:queue:complete-pr -- --issue <number> --yes
```

Complete-PR mode requires the linked PR to be in GitHub's merged state, then
sets `Status = Done`, `Agent State = Done`, refreshes `PR` and
`Last Heartbeat`, and clears `Blocked By`. It does not merge PRs, delete
branches, or remove local worktrees.

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
