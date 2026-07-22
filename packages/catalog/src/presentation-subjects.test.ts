import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "./contract.js"
import {
  CATALOG_PRESENTATION_SUBJECT_MODULES,
  createPresentationSubjectRegistry,
  getCatalogPresentationSubjectDefinition,
  isCatalogPresentationSubjectModule,
} from "./presentation-subjects.js"

const registry = createFieldPolicyRegistry(
  defineFieldPolicy([
    {
      path: "name",
      class: "merchandisable",
      merge: "replace",
      editRole: "marketing",
      visibility: ["staff", "customer"],
      overrideFriction: "none",
      snapshot: "on-book",
    },
  ]),
)

describe("catalog presentation subject registry", () => {
  it("registers canonical identifiers for sellable entries and referenced subjects", () => {
    const subjects = createPresentationSubjectRegistry([
      {
        definition: getCatalogPresentationSubjectDefinition(
          CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS,
        )!,
        registry,
      },
      {
        definition: getCatalogPresentationSubjectDefinition(
          CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATION_PROPERTIES,
        )!,
        registry,
      },
    ])

    expect(subjects.has(CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS)).toBe(true)
    expect(subjects.has(CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATION_PROPERTIES)).toBe(true)
    expect(subjects.get(CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS)?.definition.kind).toBe(
      "referenced",
    )
  })

  it("recognizes only centrally registered presentation subject modules", () => {
    expect(isCatalogPresentationSubjectModule("cruise-ships")).toBe(true)
    expect(isCatalogPresentationSubjectModule("hotels")).toBe(false)
    expect(getCatalogPresentationSubjectDefinition("accommodation-properties")?.kind).toBe(
      "referenced",
    )
  })
})
