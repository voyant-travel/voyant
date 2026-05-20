import { describe, expect, it } from "vitest"

import type {
  AdapterCapabilities,
  CancelRequest,
  CancelResult,
  GetContentRequest,
  GetContentResult,
  ReserveRequest,
  SourceAdapter,
} from "./contract.js"
import { cancelRequestSchema, reserveRequestSchema } from "./schemas.js"

describe("AdapterCapabilities — content fetch declaration", () => {
  it("accepts adapters that omit supportsContentFetch (backward compatible)", () => {
    const cap: AdapterCapabilities = {
      verticals: ["products"],
      supportsLiveResolution: true,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      postBookOperations: [],
    }
    expect(cap.supportsContentFetch).toBeUndefined()
    expect(cap.supportedContentLocales).toBeUndefined()
  })

  it("records supportsContentFetch + supportedContentLocales when declared", () => {
    const cap: AdapterCapabilities = {
      verticals: ["products"],
      supportsLiveResolution: true,
      supportsDriftDetection: false,
      supportsBookingForwarding: true,
      postBookOperations: ["cancel"],
      supportsContentFetch: true,
      supportedContentLocales: ["en-GB", "ro-RO", "de-DE"],
    }
    expect(cap.supportsContentFetch).toBe(true)
    expect(cap.supportedContentLocales).toEqual(["en-GB", "ro-RO", "de-DE"])
  })
})

describe("GetContentRequest / GetContentResult shape", () => {
  it("requires entity_module, entity_id, and locale", () => {
    const req: GetContentRequest = {
      entity_module: "products",
      entity_id: "prod_abc",
      locale: "ro-RO",
    }
    expect(req.locale).toBe("ro-RO")
    expect(req.market).toBeUndefined()
    expect(req.currency).toBeUndefined()
  })

  it("carries optional market + currency scope axes", () => {
    const req: GetContentRequest = {
      entity_module: "cruises",
      entity_id: "crus_xyz",
      locale: "de-DE",
      market: "DE",
      currency: "EUR",
    }
    expect(req.market).toBe("DE")
    expect(req.currency).toBe("EUR")
  })

  it("returned_locale may differ from request.locale (upstream fallback)", () => {
    const result: GetContentResult = {
      entity_module: "products",
      entity_id: "prod_abc",
      source_ref: "TUI-123",
      // Asked for ro-RO, upstream had no Romanian → served en-GB.
      returned_locale: "en-GB",
      content: { product: { name: "Sample" } },
      content_schema_version: "products/v1",
    }
    expect(result.returned_locale).toBe("en-GB")
    expect(result.machine_translated).toBeUndefined()
  })

  it("flags machine_translated when upstream marks the payload", () => {
    const result: GetContentResult = {
      entity_module: "products",
      entity_id: "prod_abc",
      source_ref: "TUI-123",
      returned_locale: "ro-RO",
      machine_translated: true,
      content: { product: { name: "Mostră" } },
      content_schema_version: "products/v1",
    }
    expect(result.machine_translated).toBe(true)
  })
})

describe("SourceAdapter — getContent capability gating", () => {
  it("typechecks without getContent (capability not declared)", () => {
    const adapter: SourceAdapter = {
      kind: "thin",
      capabilities: {
        verticals: ["products"],
        supportsLiveResolution: false,
        supportsDriftDetection: false,
        supportsBookingForwarding: false,
        postBookOperations: [],
        supportsContentFetch: false,
      },
      async connect() {},
      async pause() {},
      async disconnect() {},
      async getState() {
        return "active"
      },
      async discover() {
        return { projections: [], next_cursor: undefined }
      },
    }
    expect(adapter.getContent).toBeUndefined()
    expect(adapter.capabilities.supportsContentFetch).toBe(false)
  })

  it("typechecks with getContent implemented", async () => {
    const adapter: SourceAdapter = {
      kind: "rich",
      capabilities: {
        verticals: ["products"],
        supportsLiveResolution: false,
        supportsDriftDetection: false,
        supportsBookingForwarding: false,
        postBookOperations: [],
        supportsContentFetch: true,
        supportedContentLocales: ["en-GB"],
      },
      async connect() {},
      async pause() {},
      async disconnect() {},
      async getState() {
        return "active"
      },
      async discover() {
        return { projections: [], next_cursor: undefined }
      },
      async getContent(_ctx, request) {
        return {
          entity_module: request.entity_module,
          entity_id: request.entity_id,
          source_ref: "ref-1",
          returned_locale: "en-GB",
          content: { product: { name: "Test" } },
          content_schema_version: "products/v1",
        }
      },
    }
    expect(adapter.getContent).toBeDefined()
    const result = await adapter.getContent!(
      { connection_id: "conn_1" },
      { entity_module: "products", entity_id: "prod_abc", locale: "ro-RO" },
    )
    expect(result.returned_locale).toBe("en-GB")
    expect(result.content_schema_version).toBe("products/v1")
  })
})

describe("ReserveRequest / CancelRequest scoped write shape", () => {
  it("round-trips reserve requests with request scope and idempotency key", () => {
    const request: ReserveRequest = {
      entity_module: "products",
      entity_id: "prod_abc",
      parameters: { departureId: "dep_1" },
      party: { travelers: 2 },
      scope: {
        locale: "en-GB",
        audience: "customer",
        market: "GB",
        currency: "GBP",
      },
      idempotency_key: "reserve_abc",
    }

    expect(reserveRequestSchema.parse(request)).toEqual(request)
  })

  it("round-trips cancel requests with request scope and idempotency key", () => {
    const request: CancelRequest = {
      upstream_ref: "booking_abc",
      reason: "customer_request",
      scope: {
        locale: "en-GB",
        audience: "customer",
        market: "GB",
        currency: "GBP",
      },
      idempotency_key: "cancel_abc",
    }

    expect(cancelRequestSchema.parse(request)).toEqual(request)
  })
})

describe("SourceAdapter — cancellation capability declaration", () => {
  it("typechecks sync cancellation adapters that return terminal statuses", async () => {
    const adapter: SourceAdapter = {
      kind: "sync-cancel",
      capabilities: {
        verticals: ["products"],
        supportsLiveResolution: false,
        supportsDriftDetection: false,
        supportsBookingForwarding: true,
        supportsSyncCancellation: true,
        postBookOperations: ["cancel"],
      },
      async cancel(): Promise<CancelResult> {
        return { status: "cancelled", refund_amount: 100, refund_currency: "GBP" }
      },
    }

    await expect(
      adapter.cancel!({ connection_id: "conn_1" }, { upstream_ref: "up_1" }),
    ).resolves.toEqual({
      status: "cancelled",
      refund_amount: 100,
      refund_currency: "GBP",
    })
  })

  it("typechecks async cancellation adapters that return pending", async () => {
    const adapter: SourceAdapter = {
      kind: "async-cancel",
      capabilities: {
        verticals: ["products"],
        supportsLiveResolution: false,
        supportsDriftDetection: true,
        supportsBookingForwarding: true,
        supportsSyncCancellation: false,
        postBookOperations: ["cancel"],
      },
      async cancel(): Promise<CancelResult> {
        return { status: "pending", pending_channel: "partner portal" }
      },
    }

    await expect(
      adapter.cancel!({ connection_id: "conn_1" }, { upstream_ref: "up_1" }),
    ).resolves.toEqual({
      status: "pending",
      pending_channel: "partner portal",
    })
  })
})
