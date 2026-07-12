import type { CompositionContext } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import { describe, expect, it } from "vitest"
import {
  defineDeploymentExtension,
  defineDeploymentModule,
  extensionsFromGlob,
  modulesFromGlob,
} from "./discover-modules.js"

const loyalty: HonoModule = { module: { name: "loyalty" } }
const bookingNotes: HonoExtension = { extension: { name: "booking-notes", module: "bookings" } }
// The factories under test ignore capabilities; cast a minimal context.
const ctx = { capabilities: {}, options: {} } as CompositionContext<unknown>

describe("defineDeploymentModule", () => {
  it("wraps a ready HonoModule in a factory", () => {
    const factory = defineDeploymentModule(loyalty)
    expect(typeof factory).toBe("function")
    expect(factory(ctx)).toBe(loyalty)
  })

  it("passes a factory through unchanged (identity)", () => {
    const original = () => loyalty
    expect(defineDeploymentModule(original)).toBe(original)
  })

  it("supports a HonoModule[] declaration", () => {
    const pair: HonoModule[] = [loyalty, { module: { name: "loyalty-admin" } }]
    expect(defineDeploymentModule(pair)(ctx)).toBe(pair)
  })
})

describe("modulesFromGlob", () => {
  it("keys each module by its <name> directory segment", () => {
    const registry = modulesFromGlob({
      "../modules/loyalty/index.ts": { default: loyalty },
      "../modules/gift-cards/index.ts": { default: () => ({ module: { name: "gift-cards" } }) },
    })
    expect(Object.keys(registry).sort()).toEqual(["gift-cards", "loyalty"])
    expect(registry.loyalty?.(ctx)).toBe(loyalty)
  })

  it("returns an empty registry for an empty glob (no custom modules)", () => {
    expect(modulesFromGlob({})).toEqual({})
  })

  it("ignores paths that aren't a modules/<name>/index file", () => {
    const registry = modulesFromGlob({
      "../modules/loyalty/schema.ts": { default: {} },
      "../lib/helper.ts": { default: {} },
    })
    expect(registry).toEqual({})
  })

  it("throws on a matched module with no default export", () => {
    expect(() => modulesFromGlob({ "../modules/loyalty/index.ts": { named: 1 } })).toThrow(
      /no default export/,
    )
  })
})

describe("defineDeploymentExtension", () => {
  it("wraps a ready HonoExtension in a factory", () => {
    const factory = defineDeploymentExtension(bookingNotes)
    expect(typeof factory).toBe("function")
    expect(factory(ctx)).toBe(bookingNotes)
  })

  it("passes a factory through unchanged (identity)", () => {
    const original = () => bookingNotes
    expect(defineDeploymentExtension(original)).toBe(original)
  })
})

describe("extensionsFromGlob", () => {
  it("keys each extension by its <name> directory segment", () => {
    const registry = extensionsFromGlob({
      "../extensions/booking-notes/index.ts": { default: bookingNotes },
      "../extensions/order-tags/index.ts": {
        default: () => ({ extension: { name: "order-tags", module: "orders" } }),
      },
    })
    expect(Object.keys(registry).sort()).toEqual(["booking-notes", "order-tags"])
    expect(registry["booking-notes"]?.(ctx)).toBe(bookingNotes)
  })

  it("returns an empty registry for an empty glob (no custom extensions)", () => {
    expect(extensionsFromGlob({})).toEqual({})
  })

  it("does not pick up modules (only matches the extensions dir)", () => {
    expect(extensionsFromGlob({ "../modules/loyalty/index.ts": { default: loyalty } })).toEqual({})
  })

  it("throws on a matched extension with no default export", () => {
    expect(() =>
      extensionsFromGlob({ "../extensions/booking-notes/index.ts": { named: 1 } }),
    ).toThrow(/no default export/)
  })
})
