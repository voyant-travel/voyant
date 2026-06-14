"use client"

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  defaultFetcher,
  useVoyantReactContext,
  type VoyantFetcher,
  type VoyantReactContextValue,
  VoyantReactProvider,
  type VoyantReactProviderProps,
} from "@voyant-travel/react"
import {
  createWorkflowRunsClientOptions,
  getWorkflowRun,
  type ListWorkflowRunsQuery,
  listWorkflowRuns,
  rerunWorkflowRun,
  resumeWorkflowRun,
  type WorkflowRunsClientOptions,
  workflowRunIsTerminal,
  workflowRunsQueryKeys,
} from "./workflow-runs-client.js"

export * from "./workflow-runs-client.js"
export {
  defaultFetcher,
  useVoyantReactContext as useVoyantWorkflowsContext,
  type VoyantFetcher,
  type VoyantReactContextValue as VoyantWorkflowsContextValue,
  VoyantReactProvider as VoyantWorkflowsProvider,
  type VoyantReactProviderProps as VoyantWorkflowsProviderProps,
}

export function getWorkflowRunsQueryOptions(
  query: ListWorkflowRunsQuery = {},
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
  options: { pollIntervalMs?: number } = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? 5000

  return queryOptions({
    queryKey: workflowRunsQueryKeys.list(query),
    queryFn: () => listWorkflowRuns(query, client),
    refetchInterval: (queryState) => {
      const data = queryState.state.data
      return data?.data.some((run) => !workflowRunIsTerminal(run.status)) ? pollIntervalMs : false
    },
    refetchIntervalInBackground: false,
  })
}

export function getWorkflowRunQueryOptions(
  id: string | null | undefined,
  client: WorkflowRunsClientOptions = createWorkflowRunsClientOptions(),
  options: { pollIntervalMs?: number } = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? 2000
  const runId = id ?? ""

  return queryOptions({
    queryKey: workflowRunsQueryKeys.detail(runId),
    queryFn: () => getWorkflowRun(runId, client),
    enabled: Boolean(runId),
    refetchInterval: (queryState) => {
      const run = queryState.state.data?.data.run
      return run && !workflowRunIsTerminal(run.status) ? pollIntervalMs : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useWorkflowRuns(
  query: ListWorkflowRunsQuery = {},
  options: { pollIntervalMs?: number } = {},
) {
  const client = useVoyantReactContext()
  return useQuery(getWorkflowRunsQueryOptions(query, client, options))
}

export function useWorkflowRun(
  id: string | null | undefined,
  options: { pollIntervalMs?: number } = {},
) {
  const client = useVoyantReactContext()
  return useQuery(getWorkflowRunQueryOptions(id, client, options))
}

export function useRerunMutation() {
  const queryClient = useQueryClient()
  const client = useVoyantReactContext()

  return useMutation({
    mutationFn: (input: { id: string; confirm?: boolean }) => rerunWorkflowRun(input, client),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: workflowRunsQueryKeys.all })
      if (result.ok) {
        void queryClient.invalidateQueries({
          queryKey: workflowRunsQueryKeys.detail(result.data.parentRunId),
        })
      }
    },
  })
}

export function useResumeMutation() {
  const queryClient = useQueryClient()
  const client = useVoyantReactContext()

  return useMutation({
    mutationFn: (id: string) => resumeWorkflowRun(id, client),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: workflowRunsQueryKeys.all })
      if (result.ok) {
        void queryClient.invalidateQueries({
          queryKey: workflowRunsQueryKeys.detail(result.data.parentRunId),
        })
      }
    },
  })
}
