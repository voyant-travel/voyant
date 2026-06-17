import type { CompositionContext } from "@voyant-travel/hono/composition"
import type { HonoModule } from "@voyant-travel/hono/module"
import { describe, expect, it } from "vitest"
import type { FrameworkProviders } from "./composition.js"
import { defineDeploymentModule, modulesFromGlob } from "./discover-modules.js"

const loyalty: HonoModule = { module: { name: "loyalty" } }
// The factories under test ignore capabilities; cast a minimal context.
const ctx = { capabilities: {}, options: {} } as unknown as CompositionContext<FrameworkProviders>

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
