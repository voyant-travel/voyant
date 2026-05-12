"use client"

// @voyantjs/workflows-react
//
// React hooks for triggering Voyant Workflows and subscribing to run
// state in real time. Contract defined in docs/sdk-surface.md §8.
//
// Hook signatures are the stable surface. The runtime implementation
// (WebSocket client + public-access-token flow) is installed by the
// cloud client; called directly in this package, the hooks throw.

import type { RunStatus } from "@voyantjs/workflows"
import type { StreamEvent } from "@voyantjs/workflows/protocol"
import type { VoyantError } from "@voyantjs/workflows-errors"

export * from "./workflow-runs.js"

// ---- useTriggerWorkflow ----

export interface UseTriggerOptions {
  /** Tenant endpoint that returns { runId, accessToken } on POST. */
  accessTokenEndpoint: string
  headers?: Record<string, string>
}

export interface UseTriggerResult<TIn, _TOut> {
  trigger: (input: TIn) => Promise<{ runId: string; accessToken: string }>
  run: { id: string; accessToken: string; status: RunStatus } | null
  isTriggering: boolean
  error: VoyantError | null
}

export function useTriggerWorkflow<TIn = unknown, TOut = unknown>(
  _workflowId: string,
  _opts: UseTriggerOptions,
): UseTriggerResult<TIn, TOut> {
  throw new Error(
    "@voyantjs/workflows-react: useTriggerWorkflow() requires the Voyant Cloud client runtime. " +
      "Install it via @voyantjs/client, or see docs/sdk-surface.md §8.",
  )
}

// ---- useRealtimeRun ----

export interface UseRealtimeRunResult<_TOut> {
  run: unknown | null
  events: StreamEvent[]
  metadata: Record<string, unknown>
  isConnected: boolean
  error: VoyantError | null
}

export function useRealtimeRun<TOut = unknown>(
  _runId: string | null | undefined,
  _opts: { accessToken: string | null | undefined; lastEventId?: string },
): UseRealtimeRunResult<TOut> {
  throw new Error(
    "@voyantjs/workflows-react: useRealtimeRun() called before the runtime is installed.",
  )
}

// ---- useRealtimeRunsByTag ----

export function useRealtimeRunsByTag(
  _tag: string,
  _opts: { accessToken: string | null | undefined; limit?: number },
): { runs: unknown[]; isConnected: boolean } {
  throw new Error(
    "@voyantjs/workflows-react: useRealtimeRunsByTag() called before the runtime is installed.",
  )
}

// ---- useWaitToken ----

export function useWaitToken<T = unknown>(
  _tokenId: string | null | undefined,
  _opts: { accessToken: string | null | undefined },
): { payload: T | null; isResolved: boolean; error: VoyantError | null } {
  throw new Error(
    "@voyantjs/workflows-react: useWaitToken() called before the runtime is installed.",
  )
}

// ---- useWorkflowStream ----

export function useWorkflowStream<T = unknown>(
  _runId: string | null | undefined,
  _streamId: string,
  _opts: { accessToken: string | null | undefined },
): { chunks: T[]; isComplete: boolean; error: VoyantError | null } {
  throw new Error(
    "@voyantjs/workflows-react: useWorkflowStream() called before the runtime is installed.",
  )
}
