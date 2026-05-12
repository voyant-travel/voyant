# @voyantjs/workflow-runs-ui

Importable React UI for the workflow run admin API exposed by
`@voyantjs/workflow-runs`.

```tsx
import "@voyantjs/workflow-runs-ui/styles.css"

import {
  createWorkflowRunsApiClient,
  WorkflowRunsPage,
} from "@voyantjs/workflow-runs-ui"

const workflowRunsApi = createWorkflowRunsApiClient({
  apiBase: "/api",
})

export function WorkflowsRoute() {
  return <WorkflowRunsPage api={workflowRunsApi} />
}
```

The client appends `/v1/admin/workflow-runs` to `apiBase` and sends
same-origin credentials by default. Pass a custom `fetcher`, `credentials`, or
`headers` when the operator app proxies the API differently.

The package also exports smaller primitives for apps that own routing:

```tsx
<WorkflowRunsPage
  api={workflowRunsApi}
  selectedRunId={params.id}
  onOpenRun={(id) => navigate({ to: "/workflows/$id", params: { id } })}
/>
```

Wrap the page with `WorkflowRunsUiMessagesProvider` to switch locales or
override labels.
