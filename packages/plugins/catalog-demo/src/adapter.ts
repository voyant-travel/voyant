/**
 * Thin HTTP client implementing `SourceAdapter` against the standalone
 * `catalog-demo-api` service. All persistence + state lives in that
 * service; this package contains zero business logic so it can be
 * dropped or replaced by a real upstream connector (Voyant Connect peer,
 * TUI direct API, Hotelbeds, GDS) with no template churn.
 */

import {
  type AdapterCapabilities,
  AdapterRateLimitedError,
  type CancelRequest,
  type CancelResult,
  type ConnectionState,
  type DiscoveryCursor,
  type DiscoveryPage,
  type GetContentRequest,
  type GetContentResult,
  type LiveResolveRequest,
  type LiveResolveResult,
  type PushAvailabilityRequest,
  type PushAvailabilityResult,
  type PushBookingRequest,
  type PushBookingResult,
  type PushContentRequest,
  type PushContentResult,
  type ReserveRequest,
  type ReserveResult,
  type SourceAdapter,
  type SourceAdapterContext,
} from "@voyant-travel/catalog"

/** Stable kind identifier emitted as `source.kind` on every projection. */
export const DEMO_SOURCE_KIND = "demo"

/**
 * Options accepted by `createDemoCatalogAdapter()`. The adapter is a pure
 * HTTP client — no DB handle, no in-memory state. The standalone
 * `catalog-demo-api` service owns persistence; this package round-trips.
 */
export interface DemoCatalogAdapterOptions {
  /**
   * Base URL of the running `catalog-demo-api` service (e.g.
   * `http://localhost:3330`). No trailing slash required.
   */
  baseUrl: string
  /**
   * Verticals this adapter feeds projections and sourced content for. Defaults
   * to `["products"]`; the demo API also serves cruise and accommodation
   * content payloads for multi-vertical starters.
   */
  verticals?: ReadonlyArray<string>
  /** Custom fetch implementation — useful for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch
  /** Default 8s. */
  timeoutMs?: number
}

export function createDemoCatalogAdapter(options: DemoCatalogAdapterOptions): SourceAdapter {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const verticals = normalizeDemoVerticals(options.verticals)
  const fetchImpl = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 8_000

  const capabilities: AdapterCapabilities = {
    verticals,
    supportsLiveResolution: true,
    supportsDriftDetection: false,
    supportsBookingForwarding: true,
    postBookOperations: ["cancel", "status"],
    // Demo upstream now serves rich content (highlights, days,
    // options, media, policies) via /get-content — same contract as
    // real adapters. Starters that want to demonstrate the thin-
    // synthesizer fallback can flip this and the catalog content
    // service falls through to synthesizeProductContent.
    supportsContentFetch: true,

    // Channel push (outbound). The demo upstream advertises all three
    // flows so templates can exercise the channel-push pipeline
    // end-to-end without a real channel integration.
    supportsBookingPush: true,
    supportsAvailabilityPush: true,
    supportsContentPush: true,
  }

  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const url = `${baseUrl}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        method: init?.method ?? "GET",
        headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      })
      const text = await response.text()
      const data = text ? (JSON.parse(text) as unknown) : undefined
      // Surface 429 distinctly so the channel-push pipeline can drain
      // its rate-limit bucket per the upstream's Retry-After hint.
      if (response.status === 429) {
        const retryAfterRaw = response.headers.get("Retry-After")
        const retryAfterSec = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : 60
        const retryAfterMs = (Number.isFinite(retryAfterSec) ? retryAfterSec : 60) * 1000
        throw new AdapterRateLimitedError(DEMO_SOURCE_KIND, retryAfterMs, path, data)
      }
      if (!response.ok) {
        const detail =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : response.statusText
        throw new Error(`catalog-demo-api ${init?.method ?? "GET"} ${path}: ${detail}`)
      }
      return data as T
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    kind: DEMO_SOURCE_KIND,
    capabilities,

    async connect(_ctx: SourceAdapterContext): Promise<void> {
      // Sanity-ping the upstream so misconfigured URLs surface immediately
      // instead of at first booking attempt.
      await call<{ ok: boolean }>("/health")
    },

    async pause(_ctx: SourceAdapterContext): Promise<void> {
      // Nothing local to release — the demo-api keeps running.
    },

    async disconnect(_ctx: SourceAdapterContext): Promise<void> {
      // Same as pause for the demo. Real adapters might revoke an OAuth
      // token here; the demo-api has no auth.
    },

    async getState(_ctx: SourceAdapterContext): Promise<ConnectionState> {
      try {
        await call<{ ok: boolean }>("/health")
        return "active"
      } catch {
        return "error"
      }
    },

    async discover(_ctx: SourceAdapterContext, cursor?: DiscoveryCursor): Promise<DiscoveryPage> {
      return call<DiscoveryPage>("/discover", {
        method: "POST",
        body: { cursor, entityModules: verticals },
      })
    },

    async liveResolve(
      _ctx: SourceAdapterContext,
      request: LiveResolveRequest,
    ): Promise<LiveResolveResult> {
      return call<LiveResolveResult>("/live-resolve", {
        method: "POST",
        body: request,
      })
    },

    async reserve(_ctx: SourceAdapterContext, request: ReserveRequest): Promise<ReserveResult> {
      return call<ReserveResult>("/reserve", {
        method: "POST",
        body: request,
      })
    },

    async cancel(_ctx: SourceAdapterContext, request: CancelRequest): Promise<CancelResult> {
      return call<CancelResult>("/cancel", {
        method: "POST",
        body: request,
      })
    },

    async getContent(
      _ctx: SourceAdapterContext,
      request: GetContentRequest,
    ): Promise<GetContentResult> {
      return call<GetContentResult>("/get-content", {
        method: "POST",
        body: request,
      })
    },

    // ── Channel push (outbound) ─────────────────────────────────────
    // The demo-api records pushed bookings/availability/content for
    // tests and demos to inspect.

    async pushBooking(
      _ctx: SourceAdapterContext,
      request: PushBookingRequest,
    ): Promise<PushBookingResult> {
      return call<PushBookingResult>("/push-booking", {
        method: "POST",
        body: request,
      })
    },

    async pushAvailability(
      _ctx: SourceAdapterContext,
      request: PushAvailabilityRequest,
    ): Promise<PushAvailabilityResult> {
      return call<PushAvailabilityResult>("/push-availability", {
        method: "POST",
        body: request,
      })
    },

    async pushContent(
      _ctx: SourceAdapterContext,
      request: PushContentRequest,
    ): Promise<PushContentResult> {
      return call<PushContentResult>("/push-content", {
        method: "POST",
        body: request,
      })
    },
  }
}

function normalizeDemoVerticals(verticals: DemoCatalogAdapterOptions["verticals"]): string[] {
  if (!verticals?.length) return ["products"]
  const supported = new Set(["products", "cruises", "accommodations"])
  const unsupported = verticals.filter((vertical) => !supported.has(vertical))
  if (unsupported.length > 0) {
    throw new Error(`catalog-demo adapter does not support vertical(s): ${unsupported.join(", ")}`)
  }
  return [...new Set(verticals)]
}
