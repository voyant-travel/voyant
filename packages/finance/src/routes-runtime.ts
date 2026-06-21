import { idempotencyKey } from "@voyant-travel/hono"
import type { Context } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import type { Env } from "./routes-shared.js"
import type { InvoiceRenditionWaitMode } from "./service-rendition-wait.js"

const DEFAULT_RENDITION_WAIT_TIMEOUT_MS = 30_000

export function csvDownload(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

export const routeIdempotencyKey = (
  scope: string,
  options: { fingerprintSearchParams?: readonly string[] } = {},
) => idempotencyKey<Env["Bindings"], Env["Variables"]>({ scope, ...options })

export function resolveWaitRequest(
  body: { wait?: InvoiceRenditionWaitMode; waitTimeoutMs?: number | undefined },
  query: { wait?: InvoiceRenditionWaitMode; waitTimeoutMs?: number | undefined },
) {
  return {
    mode: query.wait ?? body.wait ?? "none",
    timeoutMs: query.waitTimeoutMs ?? body.waitTimeoutMs ?? DEFAULT_RENDITION_WAIT_TIMEOUT_MS,
  }
}

export async function buildInlineDownload(
  c: Context<Env>,
  reference: { storageKey?: string | null; metadata?: unknown },
) {
  const runtime = getFinanceRouteRuntime(c)
  return resolveStoredDocumentDownload(reference, {
    bindings: c.env,
    resolveDocumentDownloadUrl: runtime?.resolveDocumentDownloadUrl,
  })
}

export function getFinanceRouteRuntime(c: {
  var: { container?: { resolve: <T>(key: string) => T } }
  get?: (key: "eventBus") => FinanceRouteRuntime["eventBus"] | undefined
}) {
  const eventBus = c.get?.("eventBus")
  try {
    const runtime = c.var.container?.resolve<FinanceRouteRuntime>(
      FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
    )
    return eventBus ? { ...(runtime ?? {}), eventBus } : runtime
  } catch {
    return eventBus ? { invoiceSettlementPollers: {}, eventBus } : undefined
  }
}

export function getActionLedgerRequestContext(c: Context<Env>) {
  const context = {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }

  if (
    context.userId ||
    context.agentId ||
    context.workflowPrincipalId ||
    context.apiTokenId ||
    context.isInternalRequest
  ) {
    return context
  }

  return undefined
}
