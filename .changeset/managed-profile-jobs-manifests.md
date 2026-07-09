---
"@voyant-travel/framework": minor
---

Export the standard profile's scheduled-jobs and workflow manifests from the
framework so Voyant Cloud can provision managed deployments with no build
(voyant#3032).

Managed-profile deployments run a fixed `voyant-operator-runtime:<framework-version>`
image with no build step, so Cloud needs both the Cloud Scheduler job set and the
workflow release manifest derivable purely from a profile snapshot. Both were
reachable only from `starters/operator` (the cron list) or a build artifact (the
workflow manifest).

New subpath `@voyant-travel/framework/managed-jobs`:

- `getManagedProfileScheduledJobs(project)` — the cron jobs to create for a
  snapshot, each `{ id, cron, description, route, module }`, gated by the
  resolved module subset (always-on framework infra like `outbox-drain` plus one
  job per active owning module — e.g. dropping `@voyant-travel/distribution`
  drops the `channel-push-*` jobs). Every job POSTs `SCHEDULED_JOB_ROUTE`
  (`/__voyant/scheduled?cron=<expr>`).
- `getManagedProfileWorkflowManifest(project)` — the profile's workflow
  definitions at `{ id, config }` grain (voyant#2925), for active modules only.
- `getManagedProfileEventFilters(project)` — the `event → workflow` routing
  bindings for active modules, registered alongside the workflows (a workflow
  registered without its event filter never fires on the events meant to
  trigger it).
- `STANDARD_OPERATOR_SCHEDULED_JOBS` — the full all-modules set.

The `operator` starter now derives `OPERATOR_CRON_JOBS` (and its cron dispatch
constants) from `STANDARD_OPERATOR_SCHEDULED_JOBS` instead of a hand-maintained
list, appending only its deployment-local `external-cruise-catalog-refresh`
(`@voyant-travel/cruises` is not a standard framework module) — so the operator
and a source-free managed deployment provision the same jobs from one source.
