/**
 * Thin HTTP client implementing `SourceAdapter` against the standalone
 * `catalog-demo-api` service. All persistence + state lives in that
 * service; this package contains zero business logic so it can be
 * dropped or replaced by a real upstream connector (Voyant Connect peer,
 * TUI direct API, Hotelbeds, GDS) with no template churn.
 *
 * Mirrors the shape of `@voyantjs/plugin-flights-demo` for `flights`.
 */

import type {
  AdapterCapabilities,
  CancelRequest,
  CancelResult,
  ConnectionState,
  DiscoveryCursor,
  DiscoveryPage,
  LiveResolveRequest,
  LiveResolveResult,
  ReserveRequest,
  ReserveResult,
  SourceAdapter,
  SourceAdapterContext,
} from "@voyantjs/catalog"

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
   * Verticals this adapter feeds projections for. Defaults to `["products"]`,
   * matching the tracer scope. Other values must match the `entityModule`
   * on the demo-api's inventory rows.
   */
  verticals?: ReadonlyArray<string>
  /** Custom fetch implementation — useful for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch
  /** Default 8s. */
  timeoutMs?: number
}

export function createDemoCatalogAdapter(options: DemoCatalogAdapterOptions): SourceAdapter {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const verticals = options.verticals?.length ? Array.from(options.verticals) : ["products"]
  const fetchImpl = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 8_000

  const capabilities: AdapterCapabilities = {
    verticals,
    supportsLiveResolution: true,
    supportsDriftDetection: false,
    supportsBookingForwarding: true,
    postBookOperations: ["cancel", "status"],
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
  }
}
