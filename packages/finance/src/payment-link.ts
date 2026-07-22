export interface BuildPaymentLinkUrlOptions {
  /**
   * Customer-facing site base URL. When omitted in a browser, the current
   * origin is used; outside a browser, the helper returns a root-relative URL.
   */
  baseUrl?: string | null
  /**
   * Full customer-facing payment-session URL template. Supports `{sessionId}`.
   * When supplied, it takes precedence over `baseUrl`.
   */
  invoicePayUrlTemplate?: string | null
}

export function buildPaymentLinkUrl(
  paymentSessionId: string,
  options: BuildPaymentLinkUrlOptions = {},
): string {
  const template = normalizePaymentLinkBaseUrl(options.invoicePayUrlTemplate)
  if (template) return template.replaceAll("{sessionId}", encodeURIComponent(paymentSessionId))

  const normalizedBaseUrl = normalizePaymentLinkBaseUrl(options.baseUrl ?? getBrowserOrigin())
  const { basePath, suffix } = splitPaymentLinkBaseUrl(normalizedBaseUrl)
  const sessionPath = `/${encodeURIComponent(paymentSessionId)}`
  const path = basePath?.endsWith("/pay") ? sessionPath : `/pay${sessionPath}`

  return basePath ? `${basePath}${path}${suffix}` : `${path}${suffix}`
}

export interface BookingCheckoutUrlSettings {
  bookingCheckoutUrlTemplate?: string | null
}

export interface BuildBookingCheckoutUrlOptions {
  bookingId?: string | null
  bookingCode?: string | null
  settings?: BookingCheckoutUrlSettings | null
}

export function buildBookingCheckoutUrl(options: BuildBookingCheckoutUrlOptions): string | null {
  const template = options.settings?.bookingCheckoutUrlTemplate?.trim()
  if (!template) return null

  if (template.includes("{bookingCode}") && !options.bookingCode) return null
  if (template.includes("{bookingId}") && !options.bookingId) return null

  return template
    .replaceAll("{bookingCode}", encodeURIComponent(options.bookingCode ?? ""))
    .replaceAll("{bookingId}", encodeURIComponent(options.bookingId ?? ""))
}

function normalizePaymentLinkBaseUrl(baseUrl: string | null | undefined): string | null {
  const trimmed = baseUrl?.trim()
  if (!trimmed) return null

  return trimmed.replace(/\/+$/, "")
}

function splitPaymentLinkBaseUrl(baseUrl: string | null): {
  basePath: string | null
  suffix: string
} {
  if (!baseUrl) return { basePath: null, suffix: "" }

  const queryIndex = baseUrl.indexOf("?")
  const fragmentIndex = baseUrl.indexOf("#")
  const suffixIndex =
    queryIndex === -1
      ? fragmentIndex
      : fragmentIndex === -1
        ? queryIndex
        : Math.min(queryIndex, fragmentIndex)
  if (suffixIndex === -1) return { basePath: baseUrl, suffix: "" }

  const basePath = baseUrl.slice(0, suffixIndex).replace(/\/+$/, "")
  return {
    basePath: basePath || null,
    suffix: baseUrl.slice(suffixIndex),
  }
}

function getBrowserOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location
  return typeof location?.origin === "string" && location.origin.length > 0 ? location.origin : null
}
