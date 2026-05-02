import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { charterCatalogPolicy } from "../../src/catalog-policy.js"

describe("charterCatalogPolicy", () => {
  it("compiles into a valid registry without errors", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
  })

  it("declares the three provenance fields", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    expect(registry.byPath.has("source.kind")).toBe(true)
    expect(registry.byPath.has("source.ref")).toBe(true)
    expect(registry.byPath.has("seller.operator_id")).toBe(true)
  })

  it("classifies APA percent and MYBA template as managed snapshot-relevant fields", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    const apa = registry.byPath.get("defaultApaPercent")
    expect(apa?.class).toBe("managed")
    expect(apa?.snapshot).toBe("on-quote-and-book")
    const myba = registry.byPath.get("defaultMybaTemplateId")
    expect(myba?.class).toBe("managed")
    expect(myba?.snapshot).toBe("on-book")
    expect(myba?.drift).toBe("high")
  })

  it("classifies cached lowest-price + voyage windows as volatile-indexed", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    expect(registry.byPath.get("lowestPriceCachedAmount")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("lowestPriceCachedCurrency")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("earliestVoyageCached")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("latestVoyageCached")?.class).toBe("volatile-indexed")
  })

  it("makes default booking modes facet-affecting (per-suite vs whole-yacht filter)", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    const modes = registry.byPath.get("defaultBookingModes[]")
    expect(modes?.reindex).toBe("facet-affecting")
    expect(modes?.class).toBe("structural")
  })

  it("requires confirm friction on ops-overridable structural fields", () => {
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    expect(registry.byPath.get("regions[]")?.overrideFriction).toBe("confirm")
    expect(registry.byPath.get("themes[]")?.overrideFriction).toBe("confirm")
  })
})
