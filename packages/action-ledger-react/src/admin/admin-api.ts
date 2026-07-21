import { queryOptions } from "@tanstack/react-query"
import type {
  ActionLedgerGetResponse,
  ActionLedgerListResponse,
} from "@voyant-travel/action-ledger"

import type { VoyantActionLedgerContextValue } from "../provider.js"
import { actionLedgerQueryKeys } from "./query-keys.js"

/**
 * REST transport for the packaged action-ledger admin surfaces. The module
 * exposes plain admin REST reads, so the pages send requests through the
 * shared provider context (`baseUrl` + `fetcher`) — no app RPC client.
 */
export type ActionLedgerAdminClient = VoyantActionLedgerContextValue

class ActionLedgerApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "ActionLedgerApiError"
    this.status = status
    this.body = body
  }
}

async function getJson<T>(client: ActionLedgerAdminClient, path: string): Promise<T> {
  const response = await client.fetcher(joinUrl(client.baseUrl, path), {
    headers: { Accept: "application/json" },
  })
  const body = await safeJson(response)
  if (!response.ok) {
    throw new ActionLedgerApiError(errorMessage(response, body), response.status, body)
  }
  return body as T
}

export function getActionLedgerEntries(
  client: ActionLedgerAdminClient,
  search: URLSearchParams,
): Promise<ActionLedgerListResponse> {
  return getJson<ActionLedgerListResponse>(client, `/v1/admin/action-ledger/entries?${search}`)
}

/** Page size shared by the Logs page and the contribution's loader. */
export const ACTION_LEDGER_PAGE_SIZE = 25

/**
 * Query options for the first (unfiltered, newest-first) Logs page — the
 * contribution's loader seeds this entry, and the page's initial state
 * (empty filters, `desc` sort, first cursor) derives the identical key, so
 * the SSR-seeded cache lines up with the page's first `useQuery`.
 */
export function actionLedgerFirstPageQueryOptions(client: ActionLedgerAdminClient) {
  const search = new URLSearchParams({ sortDir: "desc" })
  const queryKey = actionLedgerQueryKeys.entries(`${search.toString()}|cursor=first`)
  search.set("limit", String(ACTION_LEDGER_PAGE_SIZE))
  return queryOptions({
    queryKey,
    queryFn: () => getActionLedgerEntries(client, search),
  })
}

export function getActionLedgerEntry(
  client: ActionLedgerAdminClient,
  id: string,
): Promise<ActionLedgerGetResponse> {
  return getJson<ActionLedgerGetResponse>(client, `/v1/admin/action-ledger/entries/${id}`)
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return `${trimmed}${path.startsWith("/") ? path : `/${path}`}`
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function errorMessage(response: Response, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error
    if (typeof error === "string") return error
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message)
    }
  }
  return `Request failed: ${response.status} ${response.statusText}`
}
