export interface BuildPaymentLinkUrlOptions {
  /**
   * Customer-facing site base URL. When omitted in a browser, the current
   * origin is used; outside a browser, the helper returns a root-relative URL.
   */
  baseUrl?: string | null
}

export function buildPaymentLinkUrl(
  paymentSessionId: string,
  options: BuildPaymentLinkUrlOptions = {},
): string {
  const path = `/pay/${encodeURIComponent(paymentSessionId)}`
  const baseUrl = normalizePaymentLinkBaseUrl(options.baseUrl ?? getBrowserOrigin())

  return baseUrl ? `${baseUrl}${path}` : path
}

function normalizePaymentLinkBaseUrl(baseUrl: string | null | undefined): string | null {
  const trimmed = baseUrl?.trim()
  if (!trimmed) return null

  return trimmed.replace(/\/+$/, "")
}

function getBrowserOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location
  return typeof location?.origin === "string" && location.origin.length > 0 ? location.origin : null
}
