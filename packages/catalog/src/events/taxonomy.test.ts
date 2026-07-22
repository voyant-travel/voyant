import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import {
  CATALOG_EVENT_CATEGORIES,
  CATALOG_EVENTS,
  type EntityOverlayChangedPayload,
  filterByVisibility,
} from "./taxonomy.js"

describe("CATALOG_EVENTS / CATALOG_EVENT_CATEGORIES", () => {
  it("declares an internal category for overlay-changed and drift-detected", () => {
    expect(CATALOG_EVENT_CATEGORIES[CATALOG_EVENTS.ENTITY_OVERLAY_CHANGED]).toBe("internal")
    expect(CATALOG_EVENT_CATEGORIES[CATALOG_EVENTS.ENTITY_DRIFT_DETECTED]).toBe("internal")
  })

  it("declares domain category for booking and source events", () => {
    expect(CATALOG_EVENT_CATEGORIES[CATALOG_EVENTS.BOOKING_COMMITTED]).toBe("domain")
    expect(CATALOG_EVENT_CATEGORIES[CATALOG_EVENTS.SOURCE_DISCONNECTED]).toBe("domain")
  })

  it("keeps stable node identity optional for legacy root and nested overlay events", () => {
    const root = {
      entity_module: "products",
      entity_id: "prod_1",
      field_path: "title",
      locale: "en-GB",
      audience: "customer",
      market: "default",
      occurred_at: "2026-07-22T00:00:00.000Z",
    } satisfies EntityOverlayChangedPayload
    const nested = {
      ...root,
      node_kind: "itinerary-day",
      node_key: "day_1",
      field_path: "description",
    } satisfies EntityOverlayChangedPayload

    expect(root).not.toHaveProperty("node_kind")
    expect(nested).toMatchObject({ node_kind: "itinerary-day", node_key: "day_1" })
  })
})

describe("filterByVisibility", () => {
  const registry = createFieldPolicyRegistry(
    defineFieldPolicy([
      {
        path: "title",
        class: "merchandisable",
        merge: "replace",
        editRole: "marketing",
        overrideFriction: "none",
        snapshot: "on-book",
        visibility: ["staff", "customer", "partner"],
      },
      {
        path: "internal_notes",
        class: "merchandisable",
        merge: "replace",
        editRole: "ops",
        overrideFriction: "none",
        snapshot: "never",
        visibility: ["staff"],
      },
    ]),
  )

  it("drops staff-only fields when filtering for a customer audience", () => {
    const filtered = filterByVisibility(
      { title: "Hello", internal_notes: "secret" },
      registry,
      "customer",
    )
    expect(filtered).toEqual({ title: "Hello" })
  })

  it("keeps all visible fields for a staff actor", () => {
    const filtered = filterByVisibility(
      { title: "Hello", internal_notes: "secret" },
      registry,
      "staff",
    )
    expect(filtered).toEqual({ title: "Hello", internal_notes: "secret" })
  })

  it("drops fields not in the registry", () => {
    const filtered = filterByVisibility({ title: "Hello", phantom: "??" }, registry, "customer")
    expect(filtered).toEqual({ title: "Hello" })
    expect("phantom" in filtered).toBe(false)
  })
})
