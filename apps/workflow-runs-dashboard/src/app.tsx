import { createWorkflowRunsApiClient, WorkflowRunsPage } from "@voyantjs/workflow-runs-ui"
import type { ReactElement } from "react"

const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api"

const workflowRunsApi = createWorkflowRunsApiClient({
  apiBase: API_BASE,
})

export function App(): ReactElement {
  return <WorkflowRunsPage api={workflowRunsApi} />
}
