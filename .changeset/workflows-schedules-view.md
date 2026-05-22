---
"@voyantjs/workflows-orchestrator-cloudflare": minor
"@voyantjs/workflows-react": minor
"@voyantjs/workflows-ui": minor
---

Add an aggregated Schedules view to the workflows UI. The Cloudflare orchestrator now serves `GET /api/schedules/:env`, projecting each workflow's registered schedule blocks with a computed `nextRunAt`, an `enabled` flag, and an optional `schedulesEnabledByEnv` master switch. `@voyantjs/workflows-react` exports a matching `createWorkflowSchedulesApiClient`, and `@voyantjs/workflows-ui` ships a `WorkflowSchedulesPage` that lists workflow id, schedule expression, next run, last run (when a runs API is passed), enabled status, and an optional "Trigger now" action.
