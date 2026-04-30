import { describe, expect, it } from "vitest"

import type { ResolvedView } from "../overlay/resolver.js"
import {
  buildSnapshotInputFromView,
  viewToFrozenPayload,
  viewToOverlayState,
} from "./snapshot-service.js"

const sampleView: ResolvedView = {
  values: new Map<string, unknown>([
    ["title", "Resolved title"],
    ["description", "Resolved description"],
    ["status", "active"],
  ]),
  hidden: new Set(["internal_notes"]),
  provenance: new Map([
    ["title", { locale: "en-GB", audience: "customer" as const, market: "default" }],
    ["description", null],
    ["status", null],
  ]),
}

describe("viewToFrozenPayload", () => {
  it("converts the resolved value Map into a JSONB-shaped object", () => {
    const frozen = viewToFrozenPayload(sampleView)
    expect(frozen).toEqual({
      title: "Resolved title",
      description: "Resolved description",
      status: "active",
    })
  })

  it("does not include hidden fields", () => {
    const frozen = viewToFrozenPayload(sampleView)
    expect(frozen).not.toHaveProperty("internal_notes")
  })
})

describe("viewToOverlayState", () => {
  it("includes only fields where an overlay was applied", () => {
    const state = viewToOverlayState(sampleView)
    expect(state).toHaveProperty("title")
    expect(state).not.toHaveProperty("description")
    expect(state).not.toHaveProperty("status")
  })

  it("records the variant slice that satisfied each overlay", () => {
    const state = viewToOverlayState(sampleView) as Record<
      string,
      { locale: string; audience: string; market: string }
    >
    expect(state.title).toEqual({
      locale: "en-GB",
      audience: "customer",
      market: "default",
    })
  })
})

describe("buildSnapshotInputFromView", () => {
  it("composes a CaptureSnapshotInput with frozen payload + overlay state", () => {
    const input = buildSnapshotInputFromView(sampleView, {
      entityModule: "products",
      entityId: "prod_xyz",
      sourceKind: "owned",
    })
    expect(input.entityModule).toBe("products")
    expect(input.entityId).toBe("prod_xyz")
    expect(input.sourceKind).toBe("owned")
    expect(input.frozenPayload).toEqual({
      title: "Resolved title",
      description: "Resolved description",
      status: "active",
    })
    expect(input.overlayStateAtCapture).toEqual({
      title: { locale: "en-GB", audience: "customer", market: "default" },
    })
  })

  it("passes through pricingBasis when supplied", () => {
    const input = buildSnapshotInputFromView(sampleView, {
      entityModule: "products",
      entityId: "prod_xyz",
      sourceKind: "owned",
      pricingBasis: {
        base_amount: 1000,
        taxes: 100,
        fees: 50,
        surcharges: 0,
        currency: "EUR",
      },
    })
    expect(input.pricingBasis?.base_amount).toBe(1000)
    expect(input.pricingBasis?.currency).toBe("EUR")
  })

  it("forwards source connection identifiers when provided", () => {
    const input = buildSnapshotInputFromView(sampleView, {
      entityModule: "cruises",
      entityId: "crse_abc",
      sourceKind: "voyant-connect",
      sourceConnectionId: "conn_viking",
      sourceRef: "WAVE2026-RHN-15D",
    })
    expect(input.sourceKind).toBe("voyant-connect")
    expect(input.sourceConnectionId).toBe("conn_viking")
    expect(input.sourceRef).toBe("WAVE2026-RHN-15D")
  })
})
