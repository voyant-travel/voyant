# Triage Labels

Canonical triage roles and their current GitHub labels.

| Role | Label | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate. |
| `needs-info` | `needs-info` | Waiting on reporter or maintainer detail. |
| `ready-for-agent` | `agent:ready` | Fully specified and maintainer-approved. |
| `ready-for-human` | `ready-for-human` | Valid work, but requires human judgment or access. |
| `wontfix` | `wontfix` | Will not be actioned. |

Every triaged issue should carry at most one state role. If labels conflict,
ask a maintainer before changing state.

`agent:ready` is special: triage agents must not apply it unless a maintainer
explicitly instructs them to do so in the current task.
