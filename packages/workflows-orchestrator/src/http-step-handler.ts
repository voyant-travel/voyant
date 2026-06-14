import { PROTOCOL_VERSION } from "@voyant-travel/workflows/protocol"
import type { StepHandler, WorkflowStepRequest, WorkflowStepResponse } from "./types.js"

interface StepHandlerError {
  error: string
  message: string
  details?: unknown
}

export interface HttpStepTarget {
  url: string
  fetch(request: Request): Promise<Response>
  label?: string
}

export interface HttpStepHandlerDeps {
  /**
   * Resolve the transport target for this workflow-step invocation.
   * Adapters can map `tenantMeta.tenantScript` to a dispatch-namespace
   * binding, a service URL, or a local proxy.
   */
  resolveTarget: (req: WorkflowStepRequest) => HttpStepTarget | Promise<HttpStepTarget>
  /** Optional HMAC signer for the X-Voyant-Dispatch-Auth header. */
  sign?: (body: string, req: WorkflowStepRequest) => Promise<string> | string
  /** Optional logger for step-level observability. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

/**
 * Build a StepHandler that serializes WorkflowStepRequest over HTTP.
 * The concrete transport target is adapter-specific; the request/response
 * mapping is shared across Cloudflare, Node, and future adapters.
 */
export function createHttpStepHandler(deps: HttpStepHandlerDeps): StepHandler {
  return async (req: WorkflowStepRequest, stepOpts) => {
    const body = JSON.stringify(req)
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "x-voyant-protocol": String(PROTOCOL_VERSION),
    }
    if (deps.sign) {
      headers["x-voyant-dispatch-auth"] = await deps.sign(body, req)
    }

    const target = await deps.resolveTarget(req)
    deps.logger?.("info", "http-step: invoking tenant step", {
      target: target.label ?? target.url,
      runId: req.runId,
      workflowId: req.workflowId,
      invocation: req.invocationCount,
    })

    let response: Response
    try {
      response = await target.fetch(
        new Request(target.url, {
          method: "POST",
          headers,
          body,
          signal: stepOpts?.signal,
        }),
      )
    } catch (err) {
      deps.logger?.("error", "http-step: tenant fetch threw", {
        target: target.label ?? target.url,
        runId: req.runId,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        status: 502,
        body: {
          error: "tenant_unreachable",
          message: err instanceof Error ? err.message : String(err),
        },
      }
    }

    const text = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        status: 502,
        body: {
          error: "tenant_invalid_response",
          message: `tenant returned non-JSON body (HTTP ${response.status})`,
        },
      }
    }

    if (response.status !== 200) {
      return { status: response.status, body: toErrorBody(parsed, response.status) }
    }
    return { status: 200, body: parsed as WorkflowStepResponse }
  }
}

function toErrorBody(parsed: unknown, fallbackStatus: number): StepHandlerError {
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    typeof (parsed as { error?: unknown }).error === "string" &&
    typeof (parsed as { message?: unknown }).message === "string"
  ) {
    return parsed as StepHandlerError
  }
  return {
    error: "tenant_error",
    message: `tenant returned HTTP ${fallbackStatus}`,
  }
}
