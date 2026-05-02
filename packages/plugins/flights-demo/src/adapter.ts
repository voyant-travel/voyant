/**
 * Thin HTTP client implementing `FlightConnectorAdapter` against the
 * standalone `flights-demo-api` service. All synthesis + persistence lives
 * in that service; this package contains zero business logic so it can be
 * dropped or replaced by a real GDS connector with no template churn.
 *
 * The adapter ignores `ctx.deps` — the demo service owns its own DB.
 */

import type {
  FlightAdapterCapabilities,
  FlightAdapterContext,
  FlightBookResponse,
  FlightCancelResponse,
  FlightConnectorAdapter,
  FlightGetOrderResponse,
  FlightOrdersListQuery,
  FlightOrdersListResponse,
  FlightPriceRequest,
  FlightPriceResponse,
  FlightSearchResponse,
} from "@voyantjs/flights/contract/adapter"
import type {
  AncillaryRequest,
  AncillaryResponse,
  FlightBookRequest,
  FlightSearchRequest,
  SeatMapRequest,
  SeatMapResponse,
} from "@voyantjs/flights/contract/types"

const CAPABILITIES: FlightAdapterCapabilities = {
  provider: "demo",
  declared: [
    "flight/holds",
    "flight/ancillaries",
    "flight/seatmap",
    "flight/seat-selection",
    "flight/branded-fares",
    "flight/list-orders",
  ],
  maxSlicesPerSearch: 4,
  defaultTimeoutMs: 5_000,
}

export interface DemoFlightAdapterOptions {
  /**
   * Base URL of the running `flights-demo-api` service (e.g.
   * `http://localhost:3320`). No trailing slash required.
   */
  baseUrl: string
  /** Custom fetch implementation — useful for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch
}

export function createDemoFlightAdapter(options: DemoFlightAdapterOptions): FlightConnectorAdapter {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? globalThis.fetch

  async function call<T>(
    path: string,
    init?: {
      method?: string
      body?: unknown
      query?: Record<string, string | string[] | undefined>
    },
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`)
    if (init?.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(key, v)
        } else {
          url.searchParams.set(key, value)
        }
      }
    }
    const response = await fetchImpl(url.toString(), {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const text = await response.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!response.ok) {
      const message =
        (typeof json === "object" && json !== null && "error" in json
          ? String((json as { error: unknown }).error)
          : null) ?? `flights-demo-api ${path} failed: ${response.status}`
      throw new Error(message)
    }
    return json as T
  }

  return {
    capabilities: CAPABILITIES,

    async searchFlights(_ctx, request: FlightSearchRequest) {
      return call<FlightSearchResponse>("/search", { method: "POST", body: request })
    },

    async priceOffer(_ctx, request: FlightPriceRequest) {
      return call<FlightPriceResponse>("/price", { method: "POST", body: request })
    },

    async bookFlight(_ctx, request: FlightBookRequest) {
      return call<FlightBookResponse>("/book", { method: "POST", body: request })
    },

    async getOrder(_ctx: FlightAdapterContext, orderId: string) {
      return call<FlightGetOrderResponse>(`/orders/${encodeURIComponent(orderId)}`)
    },

    async cancelOrder(_ctx, orderId, reason) {
      return call<FlightCancelResponse>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: reason ? { reason } : {},
      })
    },

    async listOrders(_ctx, query: FlightOrdersListQuery) {
      return call<FlightOrdersListResponse>("/orders", {
        query: {
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.limit !== undefined ? { limit: String(query.limit) } : {}),
          ...(query.search ? { q: query.search } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
      })
    },

    async getAncillaries(_ctx, request: AncillaryRequest) {
      return call<AncillaryResponse>("/ancillaries", { method: "POST", body: request })
    },

    async getSeatMap(_ctx, request: SeatMapRequest) {
      return call<SeatMapResponse>("/seatmap", { method: "POST", body: request })
    },
  }
}
