import { describe, expect, it } from "vitest"

import {
  blocksBookings,
  type CatalogDriftEvent,
  type ContentDriftEvent,
  type FieldDrift,
  maxDriftSeverity,
} from "./events.js"

describe("maxDriftSeverity", () => {
  it("returns 'none' for an empty drift list", () => {
    expect(maxDriftSeverity([])).toBe("none")
  })

  it("returns the highest severity present", () => {
    const drifts: FieldDrift[] = [
      { field_path: "a", severity: "low", had_overlay: false },
      { field_path: "b", severity: "high", had_overlay: false },
      { field_path: "c", severity: "medium", had_overlay: false },
    ]
    expect(maxDriftSeverity(drifts)).toBe("high")
  })

  it("treats critical as the top of the order", () => {
    const drifts: FieldDrift[] = [
      { field_path: "a", severity: "critical", had_overlay: true },
      { field_path: "b", severity: "high", had_overlay: false },
    ]
    expect(maxDriftSeverity(drifts)).toBe("critical")
  })
})

describe("blocksBookings", () => {
  it("returns true only for critical severity", () => {
    expect(blocksBookings("critical")).toBe(true)
    expect(blocksBookings("high")).toBe(false)
    expect(blocksBookings("medium")).toBe(false)
    expect(blocksBookings("low")).toBe(false)
    expect(blocksBookings("none")).toBe(false)
  })
})

describe("CatalogDriftEvent", () => {
  it("carries field-level drifts plus computed severity + booking-block flag", () => {
    const event: CatalogDriftEvent = {
      drift_event_id: "cdrf_01HXX",
      entity_module: "products",
      entity_id: "prod_abc",
      source_connection_id: "conn_tui",
      source_kind: "direct:tui",
      drifts: [{ field_path: "title", severity: "low", had_overlay: false }],
      detected_at: new Date(),
      max_severity: "low",
      blocks_bookings: false,
    }
    expect(event.drifts).toHaveLength(1)
    expect(event.blocks_bookings).toBe(false)
  })
})

describe("ContentDriftEvent — sibling to CatalogDriftEvent", () => {
  it("matches a single (entity_module, entity_id) when locale + market are unset", () => {
    const event: ContentDriftEvent = {
      id: "cnde_01HXX",
      entity_module: "products",
      entity_id: "prod_abc",
      kind: "content_changed",
      detected_at: new Date(),
    }
    expect(event.locale).toBeUndefined()
    expect(event.market).toBeUndefined()
    expect(event.kind).toBe("content_changed")
  })

  it("scopes invalidation to one locale + market when set", () => {
    const event: ContentDriftEvent = {
      id: "cnde_01HXY",
      entity_module: "cruises",
      entity_id: "crus_xyz",
      locale: "de-DE",
      market: "DE",
      kind: "content_changed",
      previous_etag: 'W/"abc"',
      current_etag: 'W/"def"',
      detected_at: new Date(),
    }
    expect(event.locale).toBe("de-DE")
    expect(event.market).toBe("DE")
    expect(event.previous_etag).toBe('W/"abc"')
    expect(event.current_etag).toBe('W/"def"')
  })

  it("models the locale-added kind for newly-served languages", () => {
    const event: ContentDriftEvent = {
      id: "cnde_01HXZ",
      entity_module: "products",
      entity_id: "prod_abc",
      locale: "ro-RO",
      kind: "content_locale_added",
      detected_at: new Date(),
    }
    expect(event.kind).toBe("content_locale_added")
  })

  it("models explicit invalidation for ops escalations", () => {
    const event: ContentDriftEvent = {
      id: "cnde_01HY0",
      entity_module: "products",
      entity_id: "prod_abc",
      kind: "content_invalidated",
      detected_at: new Date(),
    }
    expect(event.kind).toBe("content_invalidated")
  })
})
