import { defineFieldPolicy, type FieldPolicyInput } from "@voyant-travel/catalog/contract"

const propertyField = (
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

const ACCOMMODATION_PROPERTY_FIELD_POLICY: FieldPolicyInput[] = [
  propertyField("id", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    query: "first-class-table",
    reindex: "none",
    sourceFreshness: "static",
  }),
  propertyField("source.kind", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    visibility: ["staff"],
    reindex: "none",
  }),
  propertyField("source.ref", {
    class: "managed",
    merge: "source-only",
    editRole: "none",
    localized: false,
    visibility: ["staff"],
    reindex: "none",
  }),
  propertyField("name", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    query: "indexed-column",
  }),
  propertyField("description", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
  }),
  propertyField("hero_image_url", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    localized: false,
    reindex: "entry",
  }),
  propertyField("gallery", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
    localized: false,
    reindex: "entry",
  }),
  propertyField("highlights", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
  }),
  propertyField("amenities", {
    class: "merchandisable",
    merge: "replace",
    editRole: "marketing",
  }),
  ...[
    "star_rating",
    "brand",
    "country",
    "city",
    "address",
    "postal_code",
    "latitude",
    "longitude",
    "check_in_time",
    "check_out_time",
  ].map((path) =>
    propertyField(path, {
      class: "structural",
      merge: "source-only",
      editRole: "none",
      localized: false,
      reindex: "none",
    }),
  ),
]

/** Effective property fields denormalized onto referencing room-type documents. */
const ACCOMMODATION_PROPERTY_REFERENCE_FIELD_POLICY: FieldPolicyInput[] = [
  propertyField("property.name", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    query: "indexed-column",
  }),
  propertyField("property.description", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
  }),
  propertyField("property.heroImageUrl", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    localized: false,
    reindex: "entry",
  }),
  propertyField("property.gallery", {
    class: "merchandisable",
    merge: "source-only",
    editRole: "none",
    localized: false,
    reindex: "entry",
  }),
]

export const accommodationPropertyCatalogPolicy = defineFieldPolicy(
  ACCOMMODATION_PROPERTY_FIELD_POLICY,
)
export const accommodationPropertyReferenceCatalogPolicy = defineFieldPolicy(
  ACCOMMODATION_PROPERTY_REFERENCE_FIELD_POLICY,
)
export { ACCOMMODATION_PROPERTY_FIELD_POLICY, ACCOMMODATION_PROPERTY_REFERENCE_FIELD_POLICY }
