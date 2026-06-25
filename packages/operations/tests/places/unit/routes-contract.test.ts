import type {
  identityAddresses,
  identityContactPoints,
  identityNamedContacts,
} from "@voyant-travel/identity/schema"
import type {
  facilities,
  facilityFeatures,
  facilityOperationSchedules,
  functionSpaceCapacities,
  functionSpaces,
  properties,
  propertyGroupMembers,
  propertyGroups,
  spaceBlockPickups,
  spaceBlocks,
} from "@voyant-travel/operations/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * Response contract tests (voyant#2114 — operations places batch) for the
 * places (facilities) admin routes. Each Drizzle-backed fixture is typed as the
 * real `$inferSelect` row so column drift breaks compilation; the JSON
 * round-trip (Date → ISO string) mirrors `c.json` so a declared/actual mismatch
 * breaks the test. The schemas below mirror the response shapes declared in
 * `places/routes.ts` (§17: timestamps/dates → strings; jsonb metadata is an open
 * record).
 *
 * The facility list/get/create/update responses also carry the nine hydrated
 * address fields the service spreads onto the base facility row; those are
 * modelled here as a `facilityWithAddress` extension of the `$inferSelect`
 * fixture. The contact-point / address / named-contact sub-resources return the
 * `@voyant-travel/identity` row shapes verbatim. Function spaces use a
 * `{ data, limit, offset }` envelope (no `total`); the other paginated lists use
 * the shared `{ data, total, limit, offset }` envelope; the contact-point /
 * address sub-resource lists are bare `{ data: [...] }`.
 */

const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

const listEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const offsetEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    limit: z.number().int(),
    offset: z.number().int(),
  })

// --- declared response schemas (mirror places/routes.ts) ---------------------

const facilitySchema = z.object({
  id: z.string(),
  parentFacilityId: z.string().nullable(),
  ownerType: z.enum(["supplier", "organization", "internal", "other"]).nullable(),
  ownerId: z.string().nullable(),
  kind: z.string(),
  status: z.enum(["active", "inactive", "archived"]),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  timezone: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  address: z.string().nullable(),
})

const identityContactPointSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  kind: z.string(),
  label: z.string().nullable(),
  value: z.string(),
  normalizedValue: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const identityAddressSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  label: z.string(),
  fullText: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const identityNamedContactSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  role: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const facilityFeatureSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  category: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  valueText: z.string().nullable(),
  highlighted: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const facilityOperationScheduleSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  dayOfWeek: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  closed: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const propertySchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  propertyType: z.string(),
  brandName: z.string().nullable(),
  groupName: z.string().nullable(),
  rating: z.number().int().nullable(),
  ratingScale: z.number().int().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  policyNotes: z.string().nullable(),
  amenityNotes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const propertyGroupSchema = z.object({
  id: z.string(),
  parentGroupId: z.string().nullable(),
  groupType: z.string(),
  status: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  brandName: z.string().nullable(),
  legalName: z.string().nullable(),
  website: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const propertyGroupMemberSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  propertyId: z.string(),
  membershipRole: z.string(),
  isPrimary: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const functionSpaceSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  parentSpaceId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  areaSqm: z.number().nullable(),
  divisible: z.boolean(),
  defaultLayout: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const functionSpaceCapacitySchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  layout: z.string(),
  capacity: z.number().int(),
})

const functionSpaceWithCapacitiesSchema = functionSpaceSchema.extend({
  capacities: z.array(functionSpaceCapacitySchema),
})

const spaceBlockSchema = z.object({
  id: z.string(),
  functionSpaceId: z.string(),
  programId: z.string().nullable(),
  supplierId: z.string().nullable(),
  name: z.string(),
  status: z.string(),
  currency: z.string().nullable(),
  netRateCents: z.number().int().nullable(),
  sellRateCents: z.number().int().nullable(),
  holdStartTime: z.string().nullable(),
  holdEndTime: z.string().nullable(),
  optionDate: z.string().nullable(),
  cutoffDate: z.string().nullable(),
  attritionTerms: jsonRecord.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const spaceBlockPickupRowSchema = z.object({
  id: z.string(),
  blockId: z.string(),
  bookingId: z.string().nullable(),
  sessionId: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  units: z.number().int(),
  status: z.string(),
  pickedUpAt: isoTimestamp,
  reversedAt: isoTimestamp.nullable(),
})

// --- Drizzle-backed fixtures -------------------------------------------------

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const facilityRow: InferSelectModel<typeof facilities> = {
  id: "facilities_0000000000000000000000000",
  parentFacilityId: null,
  ownerType: "supplier",
  ownerId: "sup_0000000000000000000000000",
  kind: "hotel",
  status: "active",
  name: "Grand Hotel",
  code: "GRH",
  description: null,
  timezone: "Europe/Bucharest",
  tags: ["luxury"],
  createdAt,
  updatedAt,
}

// The service spreads the nine hydrated address fields onto every facility row.
const facilityWireRow = {
  ...facilityRow,
  addressLine1: "1 Main St",
  addressLine2: null,
  city: "Bucharest",
  region: null,
  country: "RO",
  postalCode: "010101",
  latitude: 44.43,
  longitude: 26.1,
  address: "1 Main St, Bucharest, 010101, RO",
}

const contactPointRow: InferSelectModel<typeof identityContactPoints> = {
  id: "identity_contact_points_00000000000000",
  entityType: "facility",
  entityId: facilityRow.id,
  kind: "phone",
  label: null,
  value: "+40 21 000 0000",
  normalizedValue: "+40210000000",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const addressRow: InferSelectModel<typeof identityAddresses> = {
  id: "identity_addresses_000000000000000000",
  entityType: "facility",
  entityId: facilityRow.id,
  label: "primary",
  fullText: null,
  line1: "1 Main St",
  line2: null,
  city: "Bucharest",
  region: null,
  postalCode: "010101",
  country: "RO",
  latitude: 44.43,
  longitude: 26.1,
  timezone: "Europe/Bucharest",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const namedContactRow: InferSelectModel<typeof identityNamedContacts> = {
  id: "identity_named_contacts_0000000000000000",
  entityType: "facility",
  entityId: facilityRow.id,
  role: "operations",
  name: "Ada Lovelace",
  title: "Ops Manager",
  email: "ada@example.com",
  phone: null,
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const featureRow: InferSelectModel<typeof facilityFeatures> = {
  id: "facility_features_0000000000000000000",
  facilityId: facilityRow.id,
  category: "amenity",
  code: "wifi",
  name: "Free WiFi",
  description: null,
  valueText: null,
  highlighted: true,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const scheduleRow: InferSelectModel<typeof facilityOperationSchedules> = {
  id: "facility_operation_schedules_0000000000",
  facilityId: facilityRow.id,
  dayOfWeek: "monday",
  validFrom: "2026-01-01",
  validTo: null,
  opensAt: "08:00",
  closesAt: "22:00",
  closed: false,
  notes: null,
  createdAt,
  updatedAt,
}

const propertyRow: InferSelectModel<typeof properties> = {
  id: "properties_0000000000000000000000000",
  facilityId: facilityRow.id,
  propertyType: "hotel",
  brandName: "Grand",
  groupName: null,
  rating: 5,
  ratingScale: 5,
  checkInTime: "15:00",
  checkOutTime: "11:00",
  policyNotes: null,
  amenityNotes: null,
  createdAt,
  updatedAt,
}

const propertyGroupRow: InferSelectModel<typeof propertyGroups> = {
  id: "property_groups_00000000000000000000",
  parentGroupId: null,
  groupType: "chain",
  status: "active",
  name: "Grand Collection",
  code: "GC",
  brandName: "Grand",
  legalName: null,
  website: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const propertyGroupMemberRow: InferSelectModel<typeof propertyGroupMembers> = {
  id: "property_group_members_00000000000000",
  groupId: propertyGroupRow.id,
  propertyId: propertyRow.id,
  membershipRole: "flagship",
  isPrimary: true,
  validFrom: null,
  validTo: null,
  notes: null,
  createdAt,
  updatedAt,
}

const functionSpaceRow: InferSelectModel<typeof functionSpaces> = {
  id: "function_spaces_00000000000000000000",
  facilityId: facilityRow.id,
  parentSpaceId: null,
  name: "Ballroom",
  code: "BR",
  description: null,
  areaSqm: 450.5,
  divisible: true,
  defaultLayout: "theater",
  active: true,
  sortOrder: 0,
  metadata: null,
  createdAt,
  updatedAt,
}

const capacityRow: InferSelectModel<typeof functionSpaceCapacities> = {
  id: "function_space_capacities_000000000000",
  spaceId: functionSpaceRow.id,
  layout: "theater",
  capacity: 300,
}

const spaceBlockRow: InferSelectModel<typeof spaceBlocks> = {
  id: "space_blocks_00000000000000000000000",
  functionSpaceId: functionSpaceRow.id,
  programId: null,
  supplierId: null,
  name: "Conf 2026 hold",
  status: "inquiry",
  currency: "EUR",
  netRateCents: 100000,
  sellRateCents: 150000,
  holdStartTime: "08:00",
  holdEndTime: "18:00",
  optionDate: "2026-05-01",
  cutoffDate: "2026-06-01",
  attritionTerms: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const spaceBlockPickupRow: InferSelectModel<typeof spaceBlockPickups> = {
  id: "space_block_pickups_00000000000000000",
  blockId: spaceBlockRow.id,
  bookingId: null,
  sessionId: null,
  startDate: "2026-07-01",
  endDate: "2026-07-03",
  units: 2,
  status: "active",
  pickedUpAt: createdAt,
  reversedAt: null,
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

// Single `{ data }` envelope cases (one per declared row schema).
const singleCases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "facility", row: facilityWireRow, schema: facilitySchema },
  { name: "contact point", row: contactPointRow, schema: identityContactPointSchema },
  { name: "address", row: addressRow, schema: identityAddressSchema },
  { name: "facility contact", row: namedContactRow, schema: identityNamedContactSchema },
  { name: "facility feature", row: featureRow, schema: facilityFeatureSchema },
  { name: "operation schedule", row: scheduleRow, schema: facilityOperationScheduleSchema },
  { name: "property", row: propertyRow, schema: propertySchema },
  { name: "property group", row: propertyGroupRow, schema: propertyGroupSchema },
  { name: "property group member", row: propertyGroupMemberRow, schema: propertyGroupMemberSchema },
  { name: "function space", row: functionSpaceRow, schema: functionSpaceSchema },
  { name: "space block", row: spaceBlockRow, schema: spaceBlockSchema },
  { name: "space block pickup", row: spaceBlockPickupRow, schema: spaceBlockPickupRowSchema },
]

// `{ data, total, limit, offset }` list envelope cases.
const listCases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "facility", row: facilityWireRow, schema: facilitySchema },
  { name: "facility contact", row: namedContactRow, schema: identityNamedContactSchema },
  { name: "facility feature", row: featureRow, schema: facilityFeatureSchema },
  { name: "operation schedule", row: scheduleRow, schema: facilityOperationScheduleSchema },
  { name: "property", row: propertyRow, schema: propertySchema },
  { name: "property group", row: propertyGroupRow, schema: propertyGroupSchema },
  { name: "property group member", row: propertyGroupMemberRow, schema: propertyGroupMemberSchema },
]

describe("places Drizzle-backed response contracts", () => {
  for (const { name, row, schema } of singleCases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  for (const { name, row, schema } of listCases) {
    it(`the ${name} list envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = listEnvelope(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the function-space list (no total) envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [functionSpaceRow], limit: 50, offset: 0 }))
    const parsed = offsetEnvelope(functionSpaceSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the bare contact-point list { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [contactPointRow] }))
    const parsed = z.object({ data: z.array(identityContactPointSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the bare address list { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [addressRow] }))
    const parsed = z.object({ data: z.array(identityAddressSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the function-space-with-capacities { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(
      JSON.stringify({ data: { ...functionSpaceRow, capacities: [capacityRow] } }),
    )
    const parsed = z.object({ data: functionSpaceWithCapacitiesSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete { success } envelope satisfies the declared schema", () => {
    const parsed = z.object({ success: z.literal(true) }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
