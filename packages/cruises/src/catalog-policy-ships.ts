import { defineFieldPolicy, type FieldPolicyInput } from "@voyant-travel/catalog/contract"

const shipField = (
  path: string,
  overrides: Partial<FieldPolicyInput> & Pick<FieldPolicyInput, "class" | "merge" | "editRole">,
): FieldPolicyInput => ({
  path,
  drift: "low",
  reindex: "entry-locale",
  snapshot: "on-book",
  query: "blob-only",
  localized: true,
  visibility: ["staff", "customer", "partner"],
  overrideFriction: "none",
  sourceFreshness: "sync",
  ...overrides,
})

const CRUISE_SHIP_FIELD_POLICY: FieldPolicyInput[] = [
  shipField("id", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    query: "first-class-table",
    reindex: "none",
    sourceFreshness: "static",
  }),
  shipField("source.kind", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    visibility: ["staff"],
    reindex: "none",
  }),
  shipField("source.ref", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    visibility: ["staff"],
    reindex: "none",
  }),
  shipField("name", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    query: "indexed-column",
  }),
  shipField("description", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
  }),
  shipField("gallery", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    localized: false,
    reindex: "entry",
  }),
  shipField("amenities", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
  }),
  shipField("deckPlanUrl", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    localized: false,
    reindex: "entry",
  }),
  ...[
    "shipType",
    "capacityGuests",
    "capacityCrew",
    "cabinCount",
    "deckCount",
    "lengthMeters",
    "cruisingSpeedKnots",
    "yearBuilt",
    "yearRefurbished",
    "imo",
    "isActive",
  ].map((path) =>
    shipField(path, {
      class: "structural",
      merge: "source-only",
      editRole: "none",
      localized: false,
      reindex: path === "isActive" ? "entry" : "none",
    }),
  ),
]

/**
 * Effective ship presentation fields denormalized onto every cruise document
 * that references the subject. These are deliberately distinct from the
 * cruise's own fields: a ship overlay must never overwrite the cruise title or
 * description while still making the referencing document observably change.
 */
const CRUISE_SHIP_REFERENCE_FIELD_POLICY: FieldPolicyInput[] = [
  shipField("ship.name", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
  }),
  shipField("ship.description", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
  }),
  shipField("ship.heroImageUrl", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
    localized: false,
    reindex: "entry",
  }),
  shipField("ship.gallery", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
    localized: false,
    reindex: "entry",
  }),
  shipField("ship.deckPlanUrl", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
    localized: false,
    reindex: "entry",
  }),
]

export const cruiseShipCatalogPolicy = defineFieldPolicy(CRUISE_SHIP_FIELD_POLICY)
export const cruiseShipReferenceCatalogPolicy = defineFieldPolicy(
  CRUISE_SHIP_REFERENCE_FIELD_POLICY,
)
export { CRUISE_SHIP_FIELD_POLICY, CRUISE_SHIP_REFERENCE_FIELD_POLICY }
