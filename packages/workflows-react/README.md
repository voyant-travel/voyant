# @voyantjs/workflows-react

React hooks for triggering Voyant Workflows and subscribing to runs in
real time.

```tsx
import { useTriggerWorkflow, useRealtimeRun } from "@voyantjs/workflows-react";

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
`@voyantjs/workflow-runs`.

```tsx
import {
  useWorkflowRun,
  useWorkflowRuns,
  useRerunMutation,
  useResumeMutation,
  VoyantWorkflowsProvider,
} from "@voyantjs/workflows-react";

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
