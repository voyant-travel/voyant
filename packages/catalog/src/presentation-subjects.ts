import type { FieldPolicyRegistry } from "./contract.js"

export const CATALOG_PRESENTATION_SUBJECT_MODULES = {
  PRODUCTS: "products",
  CRUISES: "cruises",
  ACCOMMODATIONS: "accommodations",
  CRUISE_SHIPS: "cruise-ships",
  ACCOMMODATION_PROPERTIES: "accommodation-properties",
} as const

export type CatalogPresentationSubjectModule =
  (typeof CATALOG_PRESENTATION_SUBJECT_MODULES)[keyof typeof CATALOG_PRESENTATION_SUBJECT_MODULES]

export type CatalogPresentationSubjectKind = "sellable" | "referenced"

export interface CatalogPresentationSubjectDefinition {
  module: CatalogPresentationSubjectModule
  kind: CatalogPresentationSubjectKind
  ownerPackage: string
  description: string
}

const DEFINITIONS = [
  {
    module: CATALOG_PRESENTATION_SUBJECT_MODULES.PRODUCTS,
    kind: "sellable",
    ownerPackage: "@voyant-travel/inventory",
    description: "Operated or sourced product catalog entry.",
  },
  {
    module: CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISES,
    kind: "sellable",
    ownerPackage: "@voyant-travel/cruises",
    description: "Cruise catalog entry.",
  },
  {
    module: CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATIONS,
    kind: "sellable",
    ownerPackage: "@voyant-travel/accommodations",
    description: "Accommodation room-option catalog entry.",
  },
  {
    module: CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS,
    kind: "referenced",
    ownerPackage: "@voyant-travel/cruises",
    description: "Referenced cruise ship presentation subject.",
  },
  {
    module: CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATION_PROPERTIES,
    kind: "referenced",
    ownerPackage: "@voyant-travel/accommodations",
    description: "Referenced accommodation property or hotel presentation subject.",
  },
] as const satisfies readonly CatalogPresentationSubjectDefinition[]

export const catalogPresentationSubjectDefinitions: readonly CatalogPresentationSubjectDefinition[] =
  DEFINITIONS

const DEFINITIONS_BY_MODULE = new Map(
  DEFINITIONS.map((definition) => [definition.module, definition]),
)

export function isCatalogPresentationSubjectModule(
  value: string,
): value is CatalogPresentationSubjectModule {
  return DEFINITIONS_BY_MODULE.has(value as CatalogPresentationSubjectModule)
}

export function getCatalogPresentationSubjectDefinition(
  module: string,
): CatalogPresentationSubjectDefinition | undefined {
  return DEFINITIONS_BY_MODULE.get(module as CatalogPresentationSubjectModule)
}

export function assertCatalogPresentationSubjectModule(
  module: string,
): CatalogPresentationSubjectModule {
  if (!isCatalogPresentationSubjectModule(module)) {
    throw new Error(`Unknown catalog presentation subject module "${module}"`)
  }
  return module
}

export interface RegisteredPresentationSubject {
  definition: CatalogPresentationSubjectDefinition
  registry: FieldPolicyRegistry
}

export function createPresentationSubjectRegistry(
  subjects: readonly RegisteredPresentationSubject[],
): ReadonlyMap<CatalogPresentationSubjectModule, RegisteredPresentationSubject> {
  const byModule = new Map<CatalogPresentationSubjectModule, RegisteredPresentationSubject>()
  for (const subject of subjects) {
    assertCatalogPresentationSubjectModule(subject.definition.module)
    if (byModule.has(subject.definition.module)) {
      throw new Error(`Duplicate catalog presentation subject "${subject.definition.module}"`)
    }
    byModule.set(subject.definition.module, subject)
  }
  return byModule
}
