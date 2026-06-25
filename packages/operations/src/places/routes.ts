/**
 * Operations "places" (facilities) admin routes — the CRUD surfaces for
 * facilities + their identity sub-resources (contact points, addresses, named
 * contacts), facility features, operation schedules, properties, property
 * groups + members, function spaces, and space-block allotment inventory.
 * Mounted on the legacy `/v1/operations/*` surface (operator React clients hit
 * those paths) AND, for the published OpenAPI admin contract, on the staff
 * surface at `/v1/admin/operations/*` (see `operations/routes.ts`).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * operations places batch). Request schemas reuse the exported `validation.ts`
 * insert/update/list-query schemas the handlers already parse; response row
 * schemas are authored here from the Drizzle `$inferSelect` shapes (§17 dates →
 * strings). The facility list/get/create/update responses also carry the nine
 * hydrated address fields the service spreads onto the base facility row. The
 * facility contact-point / address / named-contact sub-resources return
 * `@voyant-travel/identity` row shapes verbatim. Each resource group is its own
 * small `OpenAPIHono` sub-chain composed onto `facilitiesRoutes` via
 * `.route("/")` so the `.openapi()` operations propagate up through the parent
 * operations registries while keeping type-inference cost bounded (one flat
 * chain has O(n²) inference cost).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD bundle over eleven place resources (51 legs), each with a `createRoute`
 * def + co-located handler per the established admin route pattern (mirrors
 * `availability/routes-pickups.ts`). Splitting per resource would fragment the
 * single mounted instance without aiding review. See voyant#2114.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import {
  insertAddressForEntitySchema,
  insertContactPointForEntitySchema,
  updateAddressSchema as updateIdentityAddressSchema,
  updateContactPointSchema as updateIdentityContactPointSchema,
} from "@voyant-travel/identity/validation"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { facilitiesService } from "./service.js"
import { functionSpaceService } from "./service-function-spaces.js"
import { spaceBlockService } from "./service-space-blocks.js"
import {
  facilityContactListQuerySchema,
  facilityFeatureListQuerySchema,
  facilityListQuerySchema,
  facilityOperationScheduleListQuerySchema,
  insertFacilityContactSchema,
  insertFacilityFeatureSchema,
  insertFacilityOperationScheduleSchema,
  insertFacilitySchema,
  insertPropertyGroupMemberSchema,
  insertPropertyGroupSchema,
  insertPropertySchema,
  propertyGroupListQuerySchema,
  propertyGroupMemberListQuerySchema,
  propertyListQuerySchema,
  updateFacilityContactSchema,
  updateFacilityFeatureSchema,
  updateFacilityOperationScheduleSchema,
  updateFacilitySchema,
  updatePropertyGroupMemberSchema,
  updatePropertyGroupSchema,
  updatePropertySchema,
} from "./validation.js"
import {
  createFunctionSpaceSchema,
  functionSpaceListQuerySchema,
  setFunctionSpaceCapacitiesSchema,
  updateFunctionSpaceSchema,
} from "./validation-function-spaces.js"
import {
  createSpaceBlockSchema,
  reverseSpaceBlockPickupSchema,
  setSpaceBlockSlotsSchema,
  spaceBlockPickupSchema,
} from "./validation-space-blocks.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

// --- shared response building blocks -----------------------------------------

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idSchema = z.string()
const idParamSchema = z.object({ id: idSchema })
const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

/** One `application/json` "invalid request body" response entry. */
const invalidRequestResponse = {
  description: "invalid_request: request body failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
} as const

const notFoundResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorResponseSchema } },
})

const dataEnvelope = <T extends z.ZodTypeAny>(row: T) => z.object({ data: row })

// §17: timestamps/dates are serialized to ISO strings on the wire.

// --- facility row schemas ----------------------------------------------------

const facilityKindSchema = z.enum([
  "property",
  "hotel",
  "resort",
  "venue",
  "meeting_point",
  "transfer_hub",
  "airport",
  "station",
  "marina",
  "camp",
  "lodge",
  "office",
  "attraction",
  "restaurant",
  "other",
])
const facilityStatusSchema = z.enum(["active", "inactive", "archived"])
const facilityOwnerTypeSchema = z.enum(["supplier", "organization", "internal", "other"])

const facilityBaseSchema = z.object({
  id: idSchema,
  parentFacilityId: z.string().nullable(),
  ownerType: facilityOwnerTypeSchema.nullable(),
  ownerId: z.string().nullable(),
  kind: facilityKindSchema,
  status: facilityStatusSchema,
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  timezone: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// The service spreads the projected address fields onto every facility row.
const facilitySchema = facilityBaseSchema.extend({
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

// --- identity sub-resource row schemas ---------------------------------------

const contactPointKindSchema = z.enum([
  "email",
  "phone",
  "mobile",
  "whatsapp",
  "website",
  "sms",
  "fax",
  "social",
  "other",
])

const identityContactPointSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  kind: contactPointKindSchema,
  label: z.string().nullable(),
  value: z.string(),
  normalizedValue: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const addressLabelSchema = z.enum([
  "primary",
  "billing",
  "shipping",
  "mailing",
  "meeting",
  "service",
  "legal",
  "other",
])

const identityAddressSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  label: addressLabelSchema,
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

const namedContactRoleSchema = z.enum([
  "general",
  "primary",
  "reservations",
  "operations",
  "front_desk",
  "sales",
  "emergency",
  "accounting",
  "legal",
  "other",
])

const identityNamedContactSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  role: namedContactRoleSchema,
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

// --- facility-feature / operation-schedule row schemas -----------------------

const facilityFeatureCategorySchema = z.enum([
  "amenity",
  "accessibility",
  "security",
  "service",
  "policy",
  "other",
])

const facilityFeatureSchema = z.object({
  id: idSchema,
  facilityId: z.string(),
  category: facilityFeatureCategorySchema,
  code: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  valueText: z.string().nullable(),
  highlighted: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const facilityDayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])

const facilityOperationScheduleSchema = z.object({
  id: idSchema,
  facilityId: z.string(),
  dayOfWeek: facilityDayOfWeekSchema.nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  closed: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- property / group / member row schemas -----------------------------------

const propertyTypeSchema = z.enum([
  "hotel",
  "resort",
  "villa",
  "apartment",
  "hostel",
  "lodge",
  "camp",
  "other",
])

const propertySchema = z.object({
  id: idSchema,
  facilityId: z.string(),
  propertyType: propertyTypeSchema,
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

const propertyGroupTypeSchema = z.enum([
  "chain",
  "brand",
  "management_company",
  "collection",
  "portfolio",
  "cluster",
  "other",
])
const propertyGroupStatusSchema = z.enum(["active", "inactive", "archived"])

const propertyGroupSchema = z.object({
  id: idSchema,
  parentGroupId: z.string().nullable(),
  groupType: propertyGroupTypeSchema,
  status: propertyGroupStatusSchema,
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

const propertyGroupMembershipRoleSchema = z.enum([
  "member",
  "flagship",
  "managed",
  "franchise",
  "other",
])

const propertyGroupMemberSchema = z.object({
  id: idSchema,
  groupId: z.string(),
  propertyId: z.string(),
  membershipRole: propertyGroupMembershipRoleSchema,
  isPrimary: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- function-space / space-block row schemas --------------------------------

const functionSpaceLayoutSchema = z.enum([
  "theater",
  "classroom",
  "banquet",
  "cabaret",
  "boardroom",
  "u_shape",
  "reception",
  "hollow_square",
])

const functionSpaceSchema = z.object({
  id: idSchema,
  facilityId: z.string(),
  parentSpaceId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  areaSqm: z.number().nullable(),
  divisible: z.boolean(),
  defaultLayout: functionSpaceLayoutSchema.nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const functionSpaceCapacitySchema = z.object({
  id: idSchema,
  spaceId: z.string(),
  layout: functionSpaceLayoutSchema,
  capacity: z.number().int(),
})

// `getFunctionSpace` returns the space with its capacities matrix attached.
const functionSpaceWithCapacitiesSchema = functionSpaceSchema.extend({
  capacities: z.array(functionSpaceCapacitySchema),
})

const spaceBlockStatusSchema = z.string()

const spaceBlockSchema = z.object({
  id: idSchema,
  functionSpaceId: z.string(),
  programId: z.string().nullable(),
  supplierId: z.string().nullable(),
  name: z.string(),
  status: spaceBlockStatusSchema,
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
  id: idSchema,
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

const spaceBlockSummarySchema = z.object({
  blockId: z.string(),
  status: spaceBlockStatusSchema,
  totalHeld: z.number().int(),
  totalPickedUp: z.number().int(),
  totalReleased: z.number().int(),
  totalRemaining: z.number().int(),
  pickupProgress: z.enum(["none", "partial", "full"]),
})

// --- facilities --------------------------------------------------------------

const listFacilitiesRoute = createRoute({
  method: "get",
  path: "/facilities",
  request: { query: facilityListQuerySchema },
  responses: {
    200: {
      description: "Paginated facilities",
      content: { "application/json": { schema: listResponseSchema(facilitySchema) } },
    },
  },
})

const createFacilityRoute = createRoute({
  method: "post",
  path: "/facilities",
  request: {
    body: { required: true, content: { "application/json": { schema: insertFacilitySchema } } },
  },
  responses: {
    201: {
      description: "The created facility",
      content: { "application/json": { schema: dataEnvelope(facilitySchema) } },
    },
    400: invalidRequestResponse,
  },
})

const getFacilityRoute = createRoute({
  method: "get",
  path: "/facilities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A facility by id",
      content: { "application/json": { schema: dataEnvelope(facilitySchema) } },
    },
    404: notFoundResponse("Facility not found"),
  },
})

const updateFacilityRoute = createRoute({
  method: "patch",
  path: "/facilities/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateFacilitySchema } } },
  },
  responses: {
    200: {
      description: "The updated facility",
      content: { "application/json": { schema: dataEnvelope(facilitySchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const deleteFacilityRoute = createRoute({
  method: "delete",
  path: "/facilities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Facility deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Facility not found"),
  },
})

const facilityRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFacilitiesRoute, async (c) =>
    c.json(await facilitiesService.listFacilities(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createFacilityRoute, async (c) => {
    const row = await facilitiesService.createFacility(c.get("db"), c.req.valid("json"))
    return c.json({ data: row }, 201)
  })
  .openapi(getFacilityRoute, async (c) => {
    const row = await facilitiesService.getFacilityById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateFacilityRoute, async (c) => {
    const row = await facilitiesService.updateFacility(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(deleteFacilityRoute, async (c) => {
    const row = await facilitiesService.deleteFacility(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Facility not found" }, 404)
  })

// --- facility contact points + addresses (identity sub-resources) ------------

const listFacilityContactPointsRoute = createRoute({
  method: "get",
  path: "/facilities/{id}/contact-points",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Contact points for a facility",
      content: {
        "application/json": { schema: dataEnvelope(z.array(identityContactPointSchema)) },
      },
    },
  },
})

const createFacilityContactPointRoute = createRoute({
  method: "post",
  path: "/facilities/{id}/contact-points",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertContactPointForEntitySchema } },
    },
  },
  responses: {
    201: {
      description: "The created contact point",
      content: { "application/json": { schema: dataEnvelope(identityContactPointSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const updateContactPointRoute = createRoute({
  method: "patch",
  path: "/contact-points/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateIdentityContactPointSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated contact point",
      content: { "application/json": { schema: dataEnvelope(identityContactPointSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Contact point not found"),
  },
})

const deleteContactPointRoute = createRoute({
  method: "delete",
  path: "/contact-points/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Contact point deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Contact point not found"),
  },
})

const listFacilityAddressesRoute = createRoute({
  method: "get",
  path: "/facilities/{id}/addresses",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Addresses for a facility",
      content: { "application/json": { schema: dataEnvelope(z.array(identityAddressSchema)) } },
    },
  },
})

const createFacilityAddressRoute = createRoute({
  method: "post",
  path: "/facilities/{id}/addresses",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertAddressForEntitySchema } },
    },
  },
  responses: {
    201: {
      description: "The created address",
      content: { "application/json": { schema: dataEnvelope(identityAddressSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const updateAddressRoute = createRoute({
  method: "patch",
  path: "/addresses/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateIdentityAddressSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated address",
      content: { "application/json": { schema: dataEnvelope(identityAddressSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Address not found"),
  },
})

const deleteAddressRoute = createRoute({
  method: "delete",
  path: "/addresses/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Address deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Address not found"),
  },
})

const facilityIdentityRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFacilityContactPointsRoute, async (c) =>
    c.json(
      { data: await facilitiesService.listContactPoints(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(createFacilityContactPointRoute, async (c) => {
    const row = await facilitiesService.createContactPoint(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateContactPointRoute, async (c) => {
    const row = await facilitiesService.updateContactPoint(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Contact point not found" }, 404)
  })
  .openapi(deleteContactPointRoute, async (c) => {
    const row = await facilitiesService.deleteContactPoint(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Contact point not found" }, 404)
  })
  .openapi(listFacilityAddressesRoute, async (c) =>
    c.json(
      { data: await facilitiesService.listAddresses(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(createFacilityAddressRoute, async (c) => {
    const row = await facilitiesService.createAddress(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateAddressRoute, async (c) => {
    const row = await facilitiesService.updateAddress(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Address not found" }, 404)
  })
  .openapi(deleteAddressRoute, async (c) => {
    const row = await facilitiesService.deleteAddress(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Address not found" }, 404)
  })

// --- facility contacts (named contacts) --------------------------------------

const listFacilityContactsRoute = createRoute({
  method: "get",
  path: "/facility-contacts",
  request: { query: facilityContactListQuerySchema },
  responses: {
    200: {
      description: "Paginated facility contacts",
      content: { "application/json": { schema: listResponseSchema(identityNamedContactSchema) } },
    },
  },
})

const createFacilityContactRoute = createRoute({
  method: "post",
  path: "/facilities/{id}/contacts",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertFacilityContactSchema } },
    },
  },
  responses: {
    201: {
      description: "The created facility contact",
      content: { "application/json": { schema: dataEnvelope(identityNamedContactSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const updateFacilityContactRoute = createRoute({
  method: "patch",
  path: "/facility-contacts/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateFacilityContactSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated facility contact",
      content: { "application/json": { schema: dataEnvelope(identityNamedContactSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility contact not found"),
  },
})

const deleteFacilityContactRoute = createRoute({
  method: "delete",
  path: "/facility-contacts/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Facility contact deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Facility contact not found"),
  },
})

const facilityContactRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFacilityContactsRoute, async (c) =>
    c.json(await facilitiesService.listFacilityContacts(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createFacilityContactRoute, async (c) => {
    const row = await facilitiesService.createFacilityContact(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateFacilityContactRoute, async (c) => {
    const row = await facilitiesService.updateFacilityContact(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Facility contact not found" }, 404)
  })
  .openapi(deleteFacilityContactRoute, async (c) => {
    const row = await facilitiesService.deleteFacilityContact(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Facility contact not found" }, 404)
  })

// --- facility features -------------------------------------------------------

const listFacilityFeaturesRoute = createRoute({
  method: "get",
  path: "/facility-features",
  request: { query: facilityFeatureListQuerySchema },
  responses: {
    200: {
      description: "Paginated facility features",
      content: { "application/json": { schema: listResponseSchema(facilityFeatureSchema) } },
    },
  },
})

const createFacilityFeatureRoute = createRoute({
  method: "post",
  path: "/facilities/{id}/features",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertFacilityFeatureSchema } },
    },
  },
  responses: {
    201: {
      description: "The created facility feature",
      content: { "application/json": { schema: dataEnvelope(facilityFeatureSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const updateFacilityFeatureRoute = createRoute({
  method: "patch",
  path: "/facility-features/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateFacilityFeatureSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated facility feature",
      content: { "application/json": { schema: dataEnvelope(facilityFeatureSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility feature not found"),
  },
})

const deleteFacilityFeatureRoute = createRoute({
  method: "delete",
  path: "/facility-features/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Facility feature deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Facility feature not found"),
  },
})

const facilityFeatureRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFacilityFeaturesRoute, async (c) =>
    c.json(await facilitiesService.listFacilityFeatures(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createFacilityFeatureRoute, async (c) => {
    const row = await facilitiesService.createFacilityFeature(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateFacilityFeatureRoute, async (c) => {
    const row = await facilitiesService.updateFacilityFeature(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Facility feature not found" }, 404)
  })
  .openapi(deleteFacilityFeatureRoute, async (c) => {
    const row = await facilitiesService.deleteFacilityFeature(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Facility feature not found" }, 404)
  })

// --- facility operation schedules --------------------------------------------

const listOperationSchedulesRoute = createRoute({
  method: "get",
  path: "/facility-operation-schedules",
  request: { query: facilityOperationScheduleListQuerySchema },
  responses: {
    200: {
      description: "Paginated facility operation schedules",
      content: {
        "application/json": { schema: listResponseSchema(facilityOperationScheduleSchema) },
      },
    },
  },
})

const createOperationScheduleRoute = createRoute({
  method: "post",
  path: "/facilities/{id}/operation-schedules",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertFacilityOperationScheduleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created facility operation schedule",
      content: { "application/json": { schema: dataEnvelope(facilityOperationScheduleSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const updateOperationScheduleRoute = createRoute({
  method: "patch",
  path: "/facility-operation-schedules/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateFacilityOperationScheduleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated facility operation schedule",
      content: { "application/json": { schema: dataEnvelope(facilityOperationScheduleSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility operation schedule not found"),
  },
})

const deleteOperationScheduleRoute = createRoute({
  method: "delete",
  path: "/facility-operation-schedules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Facility operation schedule deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Facility operation schedule not found"),
  },
})

const facilityScheduleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOperationSchedulesRoute, async (c) =>
    c.json(
      await facilitiesService.listFacilityOperationSchedules(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createOperationScheduleRoute, async (c) => {
    const row = await facilitiesService.createFacilityOperationSchedule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(updateOperationScheduleRoute, async (c) => {
    const row = await facilitiesService.updateFacilityOperationSchedule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Facility operation schedule not found" }, 404)
  })
  .openapi(deleteOperationScheduleRoute, async (c) => {
    const row = await facilitiesService.deleteFacilityOperationSchedule(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Facility operation schedule not found" }, 404)
  })

// --- properties --------------------------------------------------------------

const listPropertiesRoute = createRoute({
  method: "get",
  path: "/properties",
  request: { query: propertyListQuerySchema },
  responses: {
    200: {
      description: "Paginated properties",
      content: { "application/json": { schema: listResponseSchema(propertySchema) } },
    },
  },
})

const createPropertyRoute = createRoute({
  method: "post",
  path: "/properties",
  request: {
    body: { required: true, content: { "application/json": { schema: insertPropertySchema } } },
  },
  responses: {
    201: {
      description: "The created property",
      content: { "application/json": { schema: dataEnvelope(propertySchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility not found"),
  },
})

const getPropertyRoute = createRoute({
  method: "get",
  path: "/properties/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A property by id",
      content: { "application/json": { schema: dataEnvelope(propertySchema) } },
    },
    404: notFoundResponse("Property not found"),
  },
})

const updatePropertyRoute = createRoute({
  method: "patch",
  path: "/properties/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updatePropertySchema } } },
  },
  responses: {
    200: {
      description: "The updated property",
      content: { "application/json": { schema: dataEnvelope(propertySchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Property not found"),
  },
})

const deletePropertyRoute = createRoute({
  method: "delete",
  path: "/properties/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Property deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Property not found"),
  },
})

const propertyRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPropertiesRoute, async (c) =>
    c.json(await facilitiesService.listProperties(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPropertyRoute, async (c) => {
    const row = await facilitiesService.createProperty(c.get("db"), c.req.valid("json"))
    return row ? c.json({ data: row }, 201) : c.json({ error: "Facility not found" }, 404)
  })
  .openapi(getPropertyRoute, async (c) => {
    const row = await facilitiesService.getPropertyById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Property not found" }, 404)
  })
  .openapi(updatePropertyRoute, async (c) => {
    const row = await facilitiesService.updateProperty(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Property not found" }, 404)
  })
  .openapi(deletePropertyRoute, async (c) => {
    const row = await facilitiesService.deleteProperty(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Property not found" }, 404)
  })

// --- property groups ---------------------------------------------------------

const listPropertyGroupsRoute = createRoute({
  method: "get",
  path: "/property-groups",
  request: { query: propertyGroupListQuerySchema },
  responses: {
    200: {
      description: "Paginated property groups",
      content: { "application/json": { schema: listResponseSchema(propertyGroupSchema) } },
    },
  },
})

const createPropertyGroupRoute = createRoute({
  method: "post",
  path: "/property-groups",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPropertyGroupSchema } },
    },
  },
  responses: {
    201: {
      description: "The created property group",
      content: { "application/json": { schema: dataEnvelope(propertyGroupSchema) } },
    },
    400: invalidRequestResponse,
  },
})

const getPropertyGroupRoute = createRoute({
  method: "get",
  path: "/property-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A property group by id",
      content: { "application/json": { schema: dataEnvelope(propertyGroupSchema) } },
    },
    404: notFoundResponse("Property group not found"),
  },
})

const updatePropertyGroupRoute = createRoute({
  method: "patch",
  path: "/property-groups/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePropertyGroupSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated property group",
      content: { "application/json": { schema: dataEnvelope(propertyGroupSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Property group not found"),
  },
})

const deletePropertyGroupRoute = createRoute({
  method: "delete",
  path: "/property-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Property group deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Property group not found"),
  },
})

const propertyGroupRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPropertyGroupsRoute, async (c) =>
    c.json(await facilitiesService.listPropertyGroups(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPropertyGroupRoute, async (c) => {
    const row = await facilitiesService.createPropertyGroup(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getPropertyGroupRoute, async (c) => {
    const row = await facilitiesService.getPropertyGroupById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Property group not found" }, 404)
  })
  .openapi(updatePropertyGroupRoute, async (c) => {
    const row = await facilitiesService.updatePropertyGroup(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Property group not found" }, 404)
  })
  .openapi(deletePropertyGroupRoute, async (c) => {
    const row = await facilitiesService.deletePropertyGroup(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Property group not found" }, 404)
  })

// --- property group members --------------------------------------------------

const listPropertyGroupMembersRoute = createRoute({
  method: "get",
  path: "/property-group-members",
  request: { query: propertyGroupMemberListQuerySchema },
  responses: {
    200: {
      description: "Paginated property group members",
      content: { "application/json": { schema: listResponseSchema(propertyGroupMemberSchema) } },
    },
  },
})

const createPropertyGroupMemberRoute = createRoute({
  method: "post",
  path: "/property-group-members",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPropertyGroupMemberSchema } },
    },
  },
  responses: {
    201: {
      description: "The created property group member",
      content: { "application/json": { schema: dataEnvelope(propertyGroupMemberSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Property group or property not found"),
  },
})

const getPropertyGroupMemberRoute = createRoute({
  method: "get",
  path: "/property-group-members/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A property group member by id",
      content: { "application/json": { schema: dataEnvelope(propertyGroupMemberSchema) } },
    },
    404: notFoundResponse("Property group member not found"),
  },
})

const updatePropertyGroupMemberRoute = createRoute({
  method: "patch",
  path: "/property-group-members/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePropertyGroupMemberSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated property group member",
      content: { "application/json": { schema: dataEnvelope(propertyGroupMemberSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Property group member not found"),
  },
})

const deletePropertyGroupMemberRoute = createRoute({
  method: "delete",
  path: "/property-group-members/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Property group member deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Property group member not found"),
  },
})

const propertyGroupMemberRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPropertyGroupMembersRoute, async (c) =>
    c.json(
      await facilitiesService.listPropertyGroupMembers(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createPropertyGroupMemberRoute, async (c) => {
    const row = await facilitiesService.createPropertyGroupMember(c.get("db"), c.req.valid("json"))
    return row
      ? c.json({ data: row }, 201)
      : c.json({ error: "Property group or property not found" }, 404)
  })
  .openapi(getPropertyGroupMemberRoute, async (c) => {
    const row = await facilitiesService.getPropertyGroupMemberById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Property group member not found" }, 404)
  })
  .openapi(updatePropertyGroupMemberRoute, async (c) => {
    const row = await facilitiesService.updatePropertyGroupMember(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Property group member not found" }, 404)
  })
  .openapi(deletePropertyGroupMemberRoute, async (c) => {
    const row = await facilitiesService.deletePropertyGroupMember(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Property group member not found" }, 404)
  })

// --- function spaces (RFC voyant#1489 Phase 2) -------------------------------

const listFunctionSpacesRoute = createRoute({
  method: "get",
  path: "/function-spaces",
  request: { query: functionSpaceListQuerySchema },
  responses: {
    200: {
      description: "Function spaces (offset-paginated; no total)",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(functionSpaceSchema),
            limit: z.number().int(),
            offset: z.number().int(),
          }),
        },
      },
    },
  },
})

const createFunctionSpaceRoute = createRoute({
  method: "post",
  path: "/function-spaces",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createFunctionSpaceSchema } },
    },
  },
  responses: {
    201: {
      description: "The created function space",
      content: { "application/json": { schema: dataEnvelope(functionSpaceSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Facility or parent space not found"),
  },
})

const getFunctionSpaceRoute = createRoute({
  method: "get",
  path: "/function-spaces/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A function space with its capacity matrix",
      content: { "application/json": { schema: dataEnvelope(functionSpaceWithCapacitiesSchema) } },
    },
    404: notFoundResponse("Function space not found"),
  },
})

const updateFunctionSpaceRoute = createRoute({
  method: "patch",
  path: "/function-spaces/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateFunctionSpaceSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated function space",
      content: { "application/json": { schema: dataEnvelope(functionSpaceSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Function space not found"),
  },
})

const setFunctionSpaceCapacitiesRoute = createRoute({
  method: "put",
  path: "/function-spaces/{id}/capacities",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: setFunctionSpaceCapacitiesSchema } },
    },
  },
  responses: {
    200: {
      description: "The replaced capacity matrix",
      content: {
        "application/json": { schema: dataEnvelope(z.array(functionSpaceCapacitySchema)) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Function space not found"),
  },
})

const functionSpaceRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFunctionSpacesRoute, async (c) =>
    c.json(await functionSpaceService.listFunctionSpaces(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createFunctionSpaceRoute, async (c) => {
    const outcome = await functionSpaceService.createFunctionSpace(c.get("db"), c.req.valid("json"))
    if (outcome.status === "facility_not_found") return c.json({ error: "Facility not found" }, 404)
    if (outcome.status === "parent_not_found")
      return c.json({ error: "Parent space not found" }, 404)
    return c.json({ data: outcome.space }, 201)
  })
  .openapi(getFunctionSpaceRoute, async (c) => {
    const row = await functionSpaceService.getFunctionSpace(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Function space not found" }, 404)
  })
  .openapi(updateFunctionSpaceRoute, async (c) => {
    const row = await functionSpaceService.updateFunctionSpace(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Function space not found" }, 404)
  })
  .openapi(setFunctionSpaceCapacitiesRoute, async (c) => {
    const id = c.req.valid("param").id
    const existing = await functionSpaceService.getFunctionSpace(c.get("db"), id)
    if (!existing) return c.json({ error: "Function space not found" }, 404)
    const { capacities } = c.req.valid("json")
    return c.json(
      { data: await functionSpaceService.setFunctionSpaceCapacities(c.get("db"), id, capacities) },
      200,
    )
  })

// --- space blocks (RFC voyant#1489 §4.2) -------------------------------------

const createSpaceBlockRoute = createRoute({
  method: "post",
  path: "/space-blocks",
  request: {
    body: { required: true, content: { "application/json": { schema: createSpaceBlockSchema } } },
  },
  responses: {
    201: {
      description: "The created space block",
      content: { "application/json": { schema: dataEnvelope(spaceBlockSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Function space not found"),
  },
})

const getSpaceBlockRoute = createRoute({
  method: "get",
  path: "/space-blocks/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A space block with its allotment summary",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              block: spaceBlockSchema,
              summary: spaceBlockSummarySchema.nullable(),
            }),
          }),
        },
      },
    },
    404: notFoundResponse("Space block not found"),
  },
})

const setSpaceBlockSlotsRoute = createRoute({
  method: "put",
  path: "/space-blocks/{id}/slots",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: setSpaceBlockSlotsSchema } } },
  },
  responses: {
    200: {
      description: "The recomputed allotment summary after setting slots",
      content: { "application/json": { schema: dataEnvelope(spaceBlockSummarySchema.nullable()) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Space block not found"),
  },
})

const pickupSpaceBlockRoute = createRoute({
  method: "post",
  path: "/space-blocks/{id}/pickups",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: spaceBlockPickupSchema } } },
  },
  responses: {
    200: {
      description: "An idempotent no-op replay of an existing active pickup",
      content: { "application/json": { schema: dataEnvelope(spaceBlockPickupRowSchema) } },
    },
    201: {
      description: "The created space-block pickup",
      content: { "application/json": { schema: dataEnvelope(spaceBlockPickupRowSchema) } },
    },
    400: {
      description: "invalid_request or invalid start/end range",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: notFoundResponse("Space block not found"),
    409: {
      description: "Block no longer accepting pickups, session conflict, or insufficient inventory",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            detail: z
              .object({
                date: z.string(),
                remaining: z.number().int(),
                needed: z.number().int(),
              })
              .optional(),
          }),
        },
      },
    },
  },
})

const reverseSpaceBlockPickupRoute = createRoute({
  method: "post",
  path: "/space-blocks/{id}/pickups/reverse",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: reverseSpaceBlockPickupSchema } },
    },
  },
  responses: {
    200: {
      description: "The reversed space-block pickup",
      content: { "application/json": { schema: dataEnvelope(spaceBlockPickupRowSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Active pickup not found"),
  },
})

const releaseSpaceBlockRoute = createRoute({
  method: "post",
  path: "/space-blocks/{id}/release",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The released units and updated space block",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({ releasedUnits: z.number().int(), block: spaceBlockSchema }),
          }),
        },
      },
    },
    404: notFoundResponse("Space block not found"),
  },
})

const spaceBlockRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(createSpaceBlockRoute, async (c) => {
    const outcome = await spaceBlockService.createSpaceBlock(c.get("db"), c.req.valid("json"))
    if (outcome.status === "function_space_not_found")
      return c.json({ error: "Function space not found" }, 404)
    return c.json({ data: outcome.block }, 201)
  })
  .openapi(getSpaceBlockRoute, async (c) => {
    const id = c.req.valid("param").id
    const block = await spaceBlockService.getSpaceBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Space block not found" }, 404)
    return c.json(
      { data: { block, summary: await spaceBlockService.summarizeSpaceBlock(c.get("db"), id) } },
      200,
    )
  })
  .openapi(setSpaceBlockSlotsRoute, async (c) => {
    const id = c.req.valid("param").id
    const block = await spaceBlockService.getSpaceBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Space block not found" }, 404)
    const { slots } = c.req.valid("json")
    await spaceBlockService.setSpaceBlockSlots(c.get("db"), id, slots)
    return c.json({ data: await spaceBlockService.summarizeSpaceBlock(c.get("db"), id) }, 200)
  })
  .openapi(pickupSpaceBlockRoute, async (c) => {
    const body = c.req.valid("json")
    const outcome = await spaceBlockService.pickupSpaceBlock(c.get("db"), {
      blockId: c.req.valid("param").id,
      ...body,
    })
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.pickup }, outcome.idempotent ? 200 : 201)
      case "block_not_found":
        return c.json({ error: "Space block not found" }, 404)
      case "invalid_range":
        return c.json({ error: "Invalid start/end range" }, 400)
      case "block_not_active":
        return c.json({ error: "Space block is no longer accepting pickups" }, 409)
      case "session_conflict":
        return c.json({ error: "Session already has an active pickup on another block" }, 409)
      case "slot_unavailable":
        return c.json(
          {
            error: "Insufficient space inventory",
            detail: { date: outcome.date, remaining: outcome.remaining, needed: outcome.needed },
          },
          409,
        )
    }
  })
  .openapi(reverseSpaceBlockPickupRoute, async (c) => {
    const body = c.req.valid("json")
    const outcome = await spaceBlockService.reverseSpaceBlockPickup(c.get("db"), {
      blockId: c.req.valid("param").id,
      ...body,
    })
    if (outcome.status === "pickup_not_found")
      return c.json({ error: "Active pickup not found" }, 404)
    return c.json({ data: outcome.pickup }, 200)
  })
  .openapi(releaseSpaceBlockRoute, async (c) => {
    const outcome = await spaceBlockService.releaseSpaceBlockAtCutoff(c.get("db"), {
      blockId: c.req.valid("param").id,
    })
    if (outcome.status === "block_not_found") return c.json({ error: "Space block not found" }, 404)
    return c.json({ data: { releasedUnits: outcome.releasedUnits, block: outcome.block } }, 200)
  })

/**
 * Compose the per-resource sub-chains onto a single `OpenAPIHono` so the
 * `.openapi()` operations propagate up through the parent operations registries
 * (`OpenAPIHono.route` copies the sub-app's registered routes). Several sub-
 * chains (each ≤8 legs) keep type-inference cost bounded — one flat chain over
 * 51 legs has O(n²) inference cost.
 */
export const facilitiesRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", facilityRoutes)
  .route("/", facilityIdentityRoutes)
  .route("/", facilityContactRoutes)
  .route("/", facilityFeatureRoutes)
  .route("/", facilityScheduleRoutes)
  .route("/", propertyRoutes)
  .route("/", propertyGroupRoutes)
  .route("/", propertyGroupMemberRoutes)
  .route("/", functionSpaceRoutes)
  .route("/", spaceBlockRoutes)

export type FacilitiesRoutes = typeof facilitiesRoutes
export type PlacesRoutes = FacilitiesRoutes
export const placesRoutes = facilitiesRoutes
