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

  const baseUrl = normalizePaymentLinkBaseUrl(options.baseUrl ?? getBrowserOrigin())
  const sessionPath = `/${encodeURIComponent(paymentSessionId)}`
  const path = baseUrl?.endsWith("/pay") ? sessionPath : `/pay${sessionPath}`

  return baseUrl ? `${baseUrl}${path}` : path
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

function getBrowserOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location
  return typeof location?.origin === "string" && location.origin.length > 0 ? location.origin : null
}
