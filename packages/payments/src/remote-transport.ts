/**
 * Control-plane remote payment transport (managed mode, Phase 2B).
 *
 * The concrete `RemotePaymentTransport` the generic `createRemotePaymentAdapter`
 * delegates to. It brokers each checkout op to the platform payments control
 * plane (`/admin-runtime/payments/{initiate,status,callback/verify}`)
 * authenticated as the DEPLOYMENT (client token + deployment id — no acting
 * user, since these run at customer-checkout / inbound-IPN time). The control
 * plane resolves the deployment's connected processor, decrypts its
 * credentials, and forwards to that processor's worker.
 *
 * The deployment ships NO processor SDK — this transport plus the generic
 * adapter are the only payment code in the bundle, for any of N processors.
 */

import type { PaymentCallbackRequest, PaymentCallbackVerificationResult } from "./index.js"
import type { RemotePaymentCall, RemotePaymentTransport } from "./remote-adapter.js"

export interface ControlPlaneRemotePaymentTransportConfig {
  /**
   * Control-plane checkout base, e.g.
   * `https://api.example/cloud/v1/admin-runtime/payments`.
   */
  endpoint: string
  /** Deployment client token (bearer) + id — the deployment's own credential. */
  deploymentToken: string
  deploymentId: string
  fetchImpl?: typeof fetch
  now?: () => Date
}

function flattenHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      if (value[0] !== undefined) out[key] = value[0]
    } else if (typeof value === "string") {
      out[key] = value
    }
  }
  return out
}

export function createControlPlaneRemotePaymentTransport(
  config: ControlPlaneRemotePaymentTransportConfig,
): RemotePaymentTransport {
  const doFetch = config.fetchImpl ?? fetch
  const base = config.endpoint.replace(/\/+$/, "")
  const now = config.now ?? (() => new Date())

  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await doFetch(`${base}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.deploymentToken}`,
        "x-voyant-deployment-id": config.deploymentId,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`Payments control plane ${path} failed (${response.status}).`)
    }
    return response.json()
  }

  /** Unwrap a `{ data: { ok, result } | { ok, error } }` control-plane body. */
  function unwrapOutcome<T>(body: unknown): T {
    const data = (body as { data?: { ok: boolean; result?: T; error?: string } }).data
    if (!data) throw new Error("Malformed control-plane response.")
    if (!data.ok) throw new Error(data.error ?? "Control-plane operation failed.")
    if (data.result === undefined) {
      throw new Error("Control-plane response missing result.")
    }
    return data.result
  }

  return {
    async call<TResult>(rpcCall: RemotePaymentCall): Promise<TResult> {
      switch (rpcCall.method) {
        case "initiate":
          return unwrapOutcome<TResult>(await post("/initiate", rpcCall.payload))

        case "status":
          return unwrapOutcome<TResult>(await post("/status", rpcCall.payload))

        case "verifyCallback": {
          // Fail CLOSED: any transport/parse failure rejects the callback.
          const request = rpcCall.payload as PaymentCallbackRequest
          const rejected: PaymentCallbackVerificationResult = {
            verified: false,
            reason: "malformed",
          }
          try {
            const rawBody =
              typeof request.rawBody === "string"
                ? request.rawBody
                : new TextDecoder().decode(request.rawBody)
            const body = (await post("/callback/verify", {
              headers: flattenHeaders(request.headers),
              rawBody,
              receivedAt: request.receivedAt,
            })) as { data?: PaymentCallbackVerificationResult }
            return (body.data ?? rejected) as TResult
          } catch {
            return rejected as TResult
          }
        }

        case "health":
          return {
            status: "ok",
            checkedAt: now().toISOString(),
          } as TResult

        default:
          throw new Error(
            `Remote payment method "${rpcCall.method}" is not supported by the managed transport.`,
          )
      }
    },
  }
}
