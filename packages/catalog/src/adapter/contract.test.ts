import { describe, expect, it } from "vitest"

import type {
  AdapterCapabilities,
  GetContentRequest,
  GetContentResult,
  SourceAdapter,
} from "./contract.js"

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
