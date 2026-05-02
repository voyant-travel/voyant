import { ZodError } from "zod"
import type {
  NetopiaFetch,
  NetopiaMode,
  NetopiaRuntimeOptions,
  NetopiaStartPaymentRequest,
  NetopiaStartPaymentResponse,
  ResolvedNetopiaRuntimeOptions,
} from "./types.js"
import { resolvedNetopiaRuntimeOptionsSchema } from "./validation.js"

/**
 * Known Netopia API base URLs. The client appends `/payment/card/start`
 * (and any future paths) to whichever value is selected via `mode`. To
 * point at a staging proxy or test mock — or if your tenant is provisioned
 * on a non-default host — set `NETOPIA_URL` (or pass `apiUrl`) to override.
 *
 * The two hosts use *different* path conventions:
 *   - live host has a `/pay` prefix on every endpoint
 *   - sandbox host serves endpoints from the root
 * Sourced from the protravel-v3 reference implementation.
 */
export const NETOPIA_API_BASES: Record<NetopiaMode, string> = {
  live: "https://secure.mobilpay.ro/pay",
  sandbox: "https://secure.sandbox.netopia-payments.com",
}

export interface NetopiaClientApi {
  startCardPayment(request: NetopiaStartPaymentRequest): Promise<NetopiaStartPaymentResponse>
}

export interface NetopiaClientOptions
  extends Pick<ResolvedNetopiaRuntimeOptions, "apiUrl" | "apiKey"> {
  fetch?: NetopiaFetch
}

export function resolveNetopiaRuntimeOptions(
  bindings: Record<string, unknown> | undefined,
  options: NetopiaRuntimeOptions = {},
): ResolvedNetopiaRuntimeOptions {
  const env = bindings ?? {}
  const apiUrlOverride = options.apiUrl ?? coerceString(env.NETOPIA_URL)
  const mode = resolveMode(options.mode ?? coerceString(env.NETOPIA_MODE))
  const apiUrl = apiUrlOverride ?? NETOPIA_API_BASES[mode]
  const apiKey = options.apiKey ?? coerceString(env.NETOPIA_API_KEY)
  const posSignature = options.posSignature ?? coerceString(env.NETOPIA_POS_SIGNATURE)
  const notifyUrl = options.notifyUrl ?? coerceString(env.NETOPIA_NOTIFY_URL)
  const redirectUrl = options.redirectUrl ?? coerceString(env.NETOPIA_REDIRECT_URL)

  if (!apiKey) throw new Error("Missing Netopia config: NETOPIA_API_KEY")
  if (!posSignature) throw new Error("Missing Netopia config: NETOPIA_POS_SIGNATURE")
  if (!notifyUrl) throw new Error("Missing Netopia config: NETOPIA_NOTIFY_URL")
  if (!redirectUrl) throw new Error("Missing Netopia config: NETOPIA_REDIRECT_URL")

  try {
    return resolvedNetopiaRuntimeOptionsSchema.parse({
      apiUrl,
      apiKey,
      posSignature,
      notifyUrl,
      redirectUrl,
      emailTemplate: options.emailTemplate,
      language: options.language,
      successStatuses: options.successStatuses,
      processingStatuses: options.processingStatuses,
      fetch: options.fetch,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => {
          const path = issue.path.join(".") || "runtimeOptions"
          return `${path}: ${issue.message}`
        })
        .join("; ")
      throw new Error(`Invalid Netopia runtime options: ${detail}`)
    }
    throw error
  }
}

function coerceString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function resolveMode(raw: string | undefined): NetopiaMode {
  if (raw === "live" || raw === "sandbox") return raw
  if (raw !== undefined) {
    throw new Error(`Invalid NETOPIA_MODE: ${raw} (expected "sandbox" or "live")`)
  }
  // Default to sandbox so a half-configured production deploy fails into
  // the safer environment instead of charging real cards.
  return "sandbox"
}

export function createNetopiaClient(options: NetopiaClientOptions): NetopiaClientApi {
  const apiUrl = options.apiUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as NetopiaFetch | undefined)

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    if (!fetchImpl) {
      throw new Error("Netopia client requires a fetch implementation")
    }

    const response = await fetchImpl(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: options.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    let text = ""
    let json: unknown = null
    try {
      text = await response.text()
      json = text ? JSON.parse(text) : null
    } catch {
      // Surface raw text in the thrown error below.
    }

    return { ok: response.ok, status: response.status, json, text }
  }

  return {
    async startCardPayment(requestBody: NetopiaStartPaymentRequest) {
      const res = await request("POST", "/payment/card/start", requestBody)
      const json = (res.json ?? {}) as NetopiaStartPaymentResponse
      // Netopia quirk (per protravel-v3 reference): error code 101 means
      // "redirect customer to payment page" — it's success-with-redirect,
      // not a failure. The API sometimes omits `paymentURL` in this case;
      // upstream callers fall back to other fields on the session.
      if (json.error && String(json.error.code) === "101") {
        return json
      }
      if (!res.ok || json.error) {
        const detail =
          json.error?.message ??
          (res.status === 404
            ? `Endpoint not found at ${apiUrl}/payment/card/start. Verify NETOPIA_MODE/NETOPIA_URL.`
            : stripHtml(res.text).slice(0, 200))
        throw new Error(
          `Netopia start payment failed (${json.error?.code ?? res.status}): ${detail}`,
        )
      }
      return json
    },
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
