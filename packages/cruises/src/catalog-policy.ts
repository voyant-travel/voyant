/**
 * Catalog plane field policy for root `cruises` rows.
 *
 * Deferred child-entity registries: sailings, cabin categories/decks,
 * itinerary days, and pricing grids.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyant-travel/catalog/contract"

import { CRUISE_CORE_FIELD_POLICY } from "./catalog-policy-core.js"
import { CRUISE_STRUCTURE_FIELD_POLICY } from "./catalog-policy-structure.js"

const CRUISE_FIELD_POLICY: FieldPolicyInput[] = [
  ...CRUISE_CORE_FIELD_POLICY,
  ...CRUISE_STRUCTURE_FIELD_POLICY,
]

/**
 * Resolved field-policy registry for cruises. Templates wire it into the
 * indexer, overlay resolver, and snapshot capture pipeline.
 */
export const cruiseCatalogPolicy = defineFieldPolicy(CRUISE_FIELD_POLICY)

export { CRUISE_FIELD_POLICY }
