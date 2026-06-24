import { createWorkflowRunsApiClient, WorkflowRunsPage } from "@voyant-travel/workflows-react/ui"
import { useMemo } from "react"
import { getApiUrl } from "@/lib/env"
import { federatedOperatorFetcher } from "@/lib/voyant-fetcher"

export function WorkflowRunsAdminPage() {
  const api = useMemo(
    () =>
      createWorkflowRunsApiClient({
        baseUrl: getApiUrl(),
        fetcher: federatedOperatorFetcher,
      }),
    [],
  )

  return <WorkflowRunsPage api={api} />
}
