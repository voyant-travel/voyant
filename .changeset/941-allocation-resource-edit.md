---
"@voyantjs/allocation-ui": minor
---

Add an inline edit affordance for allocation resources on `SlotAllocationPage`. Each resource row in the new per-sub-type table now has a pencil button that toggles a label + capacity form alongside the existing remove button. Capacity floors at `max(1, occupants.length)` so the form cannot shrink a bucket below the travelers already sitting in it. Wired to the already-exposed `resourceMutation.update.mutateAsync`, so the resource id stays stable across edits (no more delete-and-recreate churn that broke holds and audit refs).
