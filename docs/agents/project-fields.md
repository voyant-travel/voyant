# Agent Project Fields

Recommended GitHub Project fields for `Voyant Engineering`.

| Field | Type | Purpose |
| --- | --- | --- |
| `Status` | Single select | GitHub Project workflow state used by the runner. |
| `Agent State` | Single select | Main state machine. |
| `Maintainer Approved` | Single select | Required execution gate: `No`, `Yes`. |
| `Risk` | Single select | `Low`, `Medium`, `High`, `Unknown`. |
| `Security Risk` | Single select | `None`, `Sensitive`, `Needs security review`. |
| `Verification Lane` | Single select | `package`, `verify:fast`, `verify:full`, `custom`. |
| `Triage Provider` | Single select | Intake model or `manual`. |
| `Agent Provider` | Single select | `codex`, `claude`, `manual`, `none`. |
| `Workspace` | Text | Local worktree path or remote sandbox reference. |
| `Branch` | Text | Work branch. |
| `PR` | Text | Pull request URL. |
| `Last Heartbeat` | Date | Staleness detection. |
| `Blocked By` | Text | Parent issue, dependency, or human decision. |
| `Evidence` | Text | Link to comment, artifact, or run summary. |

## Agent State Values

- `Triage`
- `Ready`
- `Planning`
- `Running`
- `Blocked`
- `Human Review`
- `Changes Requested`
- `CI Repair`
- `Merge Ready`
- `Done`
- `Abandoned`

Only maintainers move an item to `Ready`. Merge remains a maintainer decision
unless a separate maintainer-approved merge automation is introduced.

## Workspace Values

The runner treats `Workspace` as a typed reference, not arbitrary prose:

- Local worktree: `.agent-worktrees/<issue-number>-<slug>`
- Remote sandbox: `sandbox:<provider>:<id>`

Local commands currently execute only against local worktrees. Remote sandbox
references are reserved for the Phase 5 adapter contract and must not be
treated as filesystem paths. Cleanup only removes local worktrees under
`.agent-worktrees/`.

## Status Values

Runner commands require these status values:

- `Todo`
- `In Progress`
- `Done`

## Maintainer Approved Values

- `No`
- `Yes`

## Automation Variables

Set repository variable `VOYANT_ENGINEERING_PROJECT_URL` to the Project URL:

```text
https://github.com/orgs/voyant-travel/projects/<project-number>
```

Set repository secret `ADD_TO_PROJECT_PAT` to a token with Projects v2 write
access. Prefer a GitHub App token for long-term automation; a fine-grained PAT
is acceptable for the pilot.

Minimum pilot token permissions:

- Classic PAT: `project`; add `repo` if the repository is private.
- Fine-grained PAT: organization Projects `read & write`, repository Issues
  `read-only`, and repository Pull requests `read-only`.
