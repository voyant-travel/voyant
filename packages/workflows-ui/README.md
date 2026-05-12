# @voyantjs/workflows-ui

Importable React UI for the workflow run admin API exposed by
`@voyantjs/workflow-runs`.

```tsx
import "@voyantjs/workflows-ui/styles.css"

import { createWorkflowRunsApiClient, WorkflowRunsPage } from "@voyantjs/workflows-ui"

const workflowsApi = createWorkflowRunsApiClient({
  apiBase: "/api",
})

export function WorkflowsRoute() {
  return <WorkflowRunsPage api={workflowsApi} />
}
```

The package exports `WorkflowRunsPage` and `WorkflowRunDetailPage`. Route-owning
apps can wire deep links by controlling the selected run id:

```tsx
<WorkflowRunsPage
  api={workflowsApi}
  selectedRunId={params.id}
  onOpenRun={(id) => navigate({ to: "/workflows/$id", params: { id } })}
/>
```

This package is the public workflows-facing import path. The implementation is
shared with `@voyantjs/workflow-runs-ui` so existing consumers can migrate
incrementally.
