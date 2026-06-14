# @voyant-travel/workflows-react

The workflows client tier: headless hooks and API clients plus the styled
workflow-run admin UI (formerly `@voyant-travel/workflows-ui`).

Headless consumers import from the root, `./workflow-runs`,
`./workflow-runs-client`, or `./workflow-schedules-client` — these pull no
styling peers. Styled surfaces live under `./ui`, `./components/*`, `./client`,
`./i18n`, and `./styles.css`, whose heavier peers (`@voyant-travel/ui`,
`lucide-react`) are optional and only needed when you import those subpaths.

React hooks for triggering Voyant Workflows and subscribing to runs in
real time. The package also includes admin workflow-run observability hooks for
the `/v1/admin/workflow-runs` routes exposed by `@voyant-travel/workflow-runs`.

```tsx
import { useTriggerWorkflow, useRealtimeRun } from "@voyant-travel/workflows-react";

export function GenerateContractButton() {
  const { trigger, run } = useTriggerWorkflow("generate-contract", {
    accessTokenEndpoint: "/api/voyant/token",
  });
  const live = useRealtimeRun(run?.id, { accessToken: run?.accessToken });

  return <button onClick={() => trigger({ customerId })}>Generate</button>;
}
```

See [`docs/sdk-surface.md`](../../docs/sdk-surface.md) §8.

## Workflow run admin hooks

Operator apps can also query the workflow-run admin routes shipped by
`@voyant-travel/workflow-runs`.

```tsx
import {
  useWorkflowRun,
  useWorkflowRuns,
  useRerunMutation,
  useResumeMutation,
  VoyantWorkflowsProvider,
} from "@voyant-travel/workflows-react";

function WorkflowRunsTable() {
  const runs = useWorkflowRuns({ limit: 50 });
  return runs.data?.data.map((run) => <div key={run.id}>{run.workflowName}</div>);
}

function WorkflowRunDetail({ id }: { id: string }) {
  const run = useWorkflowRun(id);
  const rerun = useRerunMutation();
  const resume = useResumeMutation();

  return (
    <button onClick={() => rerun.mutate({ id, confirm: true })}>
      {run.data?.data.run.status === "failed" ? "Rerun" : "View"}
    </button>
  );
}

export function WorkflowsRoute() {
  return (
    <VoyantWorkflowsProvider baseUrl="/api">
      <WorkflowRunsTable />
    </VoyantWorkflowsProvider>
  );
}
```

`useWorkflowRuns` polls every 5 seconds only while the visible list contains a
running workflow. `useWorkflowRun` polls every 2 seconds while the selected run
is running. Both stop polling in background tabs.

## UI components

Importable React UI for the workflow run admin API exposed by
`@voyant-travel/workflow-runs`.

```tsx
import "@voyant-travel/workflows-react/styles.css"

import { createWorkflowRunsApiClient, WorkflowRunsPage } from "@voyant-travel/workflows-react/ui"

const workflowsApi = createWorkflowRunsApiClient({
  apiBase: "/api",
})

export function WorkflowsRoute() {
  return <WorkflowRunsPage api={workflowsApi} />
}
```

The `./ui` subpath exports `WorkflowRunsPage` and `WorkflowRunDetailPage`.
Route-owning apps can wire deep links by controlling the selected run id:

```tsx
<WorkflowRunsPage
  api={workflowsApi}
  selectedRunId={params.id}
  onOpenRun={(id) => navigate({ to: "/workflows/$id", params: { id } })}
/>
```

`@voyant-travel/workflows-react/ui` is the public workflows-facing import path for
these surfaces. Older workflow runs UI wrapper imports should migrate here.
