import { createFieldPolicyRegistry } from "@voyant-travel/catalog/contract"
import { describe, expect, it } from "vitest"

import { accommodationCatalogPolicy } from "../../src/catalog-policy.js"
import {
  ACCOMMODATION_PROPERTY_REFERENCE_FIELD_POLICY,
  accommodationPropertyCatalogPolicy,
} from "../../src/catalog-policy-properties.js"
import { assertOverlayableAccommodationPropertyField } from "../../src/service-presentation-subjects.js"

describe("accommodationCatalogPolicy", () => {
  it("compiles into a valid registry without errors", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
  })

  it("declares the three provenance fields", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    expect(registry.byPath.has("source.kind")).toBe(true)
    expect(registry.byPath.has("source.ref")).toBe(true)
    expect(registry.byPath.has("seller.operator_id")).toBe(true)
  })

  it("declares the cross-module reference to the property facility", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    const propertyId = registry.byPath.get("propertyId")
    expect(propertyId?.class).toBe("structural")
    expect(propertyId?.reindex).toBe("facet-affecting")
    expect(propertyId?.drift).toBe("critical")
  })

  it("classifies room marketing copy as merchandisable + localized", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    expect(registry.byPath.get("name")?.localized).toBe(true)
    expect(registry.byPath.get("description")?.localized).toBe(true)
    expect(registry.byPath.get("accessibilityNotes")?.localized).toBe(true)
  })

  it("treats occupancy fields as facet-affecting structural", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    expect(registry.byPath.get("maxAdults")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("maxChildren")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("maxOccupancy")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("standardOccupancy")?.reindex).toBe("facet-affecting")
  })

  it("requires confirmation when ops edits accessibility notes", () => {
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    expect(registry.byPath.get("accessibilityNotes")?.overrideFriction).toBe("confirm")
  })
})

describe("accommodationPropertyCatalogPolicy", () => {
  it("compiles into a presentation-subject registry", () => {
    const registry = createFieldPolicyRegistry(accommodationPropertyCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
    expect(registry.byPath.get("name")?.class).toBe("merchandisable")
  })

  it("allows only vertical-owned merchandisable property overlays", () => {
    expect(() => assertOverlayableAccommodationPropertyField("name")).not.toThrow()
    expect(() => assertOverlayableAccommodationPropertyField("highlights")).not.toThrow()
    expect(() => assertOverlayableAccommodationPropertyField("latitude")).toThrow(
      /not an overlayable/i,
    )
    expect(() => assertOverlayableAccommodationPropertyField("source.ref")).toThrow(
      /not an overlayable/i,
    )
  })

  it("declares namespaced property fields for referencing room documents", () => {
    const registry = createFieldPolicyRegistry([
      ...accommodationCatalogPolicy,
      ...ACCOMMODATION_PROPERTY_REFERENCE_FIELD_POLICY,
    ])
    expect(registry.byPath.get("property.name")?.merge).toBe("source-only")
    expect(registry.byPath.get("property.heroImageUrl")?.localized).toBe(false)
    expect(() => assertOverlayableAccommodationPropertyField("property.name")).toThrow(
      /not an overlayable/i,
    )
  })
})
