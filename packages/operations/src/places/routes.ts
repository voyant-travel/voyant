import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import {
  insertAddressForEntitySchema,
  insertContactPointForEntitySchema,
  updateAddressSchema as updateIdentityAddressSchema,
  updateContactPointSchema as updateIdentityContactPointSchema,
} from "@voyant-travel/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { facilitiesService } from "./service.js"
import { functionSpaceService } from "./service-function-spaces.js"
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

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const facilitiesRoutes = new Hono<Env>()
  .get("/facilities", async (c) => {
    const query = await parseQuery(c, facilityListQuerySchema)
    return c.json(await facilitiesService.listFacilities(c.get("db"), query))
  })
  .post("/facilities", async (c) => {
    return c.json(
      {
        data: await facilitiesService.createFacility(
          c.get("db"),
          await parseJsonBody(c, insertFacilitySchema),
        ),
      },
      201,
    )
  })
  .get("/facilities/:id", async (c) => {
    const row = await facilitiesService.getFacilityById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/facilities/:id", async (c) => {
    const row = await facilitiesService.updateFacility(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFacilitySchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/facilities/:id", async (c) => {
    const row = await facilitiesService.deleteFacility(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ success: true })
  })
  .get("/facilities/:id/contact-points", async (c) => {
    return c.json({
      data: await facilitiesService.listContactPoints(c.get("db"), c.req.param("id")),
    })
  })
  .post("/facilities/:id/contact-points", async (c) => {
    const row = await facilitiesService.createContactPoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertContactPointForEntitySchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/contact-points/:id", async (c) => {
    const row = await facilitiesService.updateContactPoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateIdentityContactPointSchema),
    )
    if (!row) return c.json({ error: "Contact point not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/contact-points/:id", async (c) => {
    const row = await facilitiesService.deleteContactPoint(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Contact point not found" }, 404)
    return c.json({ success: true })
  })
  .get("/facilities/:id/addresses", async (c) => {
    return c.json({ data: await facilitiesService.listAddresses(c.get("db"), c.req.param("id")) })
  })
  .post("/facilities/:id/addresses", async (c) => {
    const row = await facilitiesService.createAddress(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertAddressForEntitySchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/addresses/:id", async (c) => {
    const row = await facilitiesService.updateAddress(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateIdentityAddressSchema),
    )
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/addresses/:id", async (c) => {
    const row = await facilitiesService.deleteAddress(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ success: true })
  })
  .get("/facility-contacts", async (c) => {
    const query = await parseQuery(c, facilityContactListQuerySchema)
    return c.json(await facilitiesService.listFacilityContacts(c.get("db"), query))
  })
  .post("/facilities/:id/contacts", async (c) => {
    const row = await facilitiesService.createFacilityContact(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertFacilityContactSchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/facility-contacts/:id", async (c) => {
    const row = await facilitiesService.updateFacilityContact(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFacilityContactSchema),
    )
    if (!row) return c.json({ error: "Facility contact not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/facility-contacts/:id", async (c) => {
    const row = await facilitiesService.deleteFacilityContact(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Facility contact not found" }, 404)
    return c.json({ success: true })
  })
  .get("/facility-features", async (c) => {
    const query = await parseQuery(c, facilityFeatureListQuerySchema)
    return c.json(await facilitiesService.listFacilityFeatures(c.get("db"), query))
  })
  .post("/facilities/:id/features", async (c) => {
    const row = await facilitiesService.createFacilityFeature(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertFacilityFeatureSchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/facility-features/:id", async (c) => {
    const row = await facilitiesService.updateFacilityFeature(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFacilityFeatureSchema),
    )
    if (!row) return c.json({ error: "Facility feature not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/facility-features/:id", async (c) => {
    const row = await facilitiesService.deleteFacilityFeature(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Facility feature not found" }, 404)
    return c.json({ success: true })
  })
  .get("/facility-operation-schedules", async (c) => {
    const query = await parseQuery(c, facilityOperationScheduleListQuerySchema)
    return c.json(await facilitiesService.listFacilityOperationSchedules(c.get("db"), query))
  })
  .post("/facilities/:id/operation-schedules", async (c) => {
    const row = await facilitiesService.createFacilityOperationSchedule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertFacilityOperationScheduleSchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/facility-operation-schedules/:id", async (c) => {
    const row = await facilitiesService.updateFacilityOperationSchedule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFacilityOperationScheduleSchema),
    )
    if (!row) return c.json({ error: "Facility operation schedule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/facility-operation-schedules/:id", async (c) => {
    const row = await facilitiesService.deleteFacilityOperationSchedule(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Facility operation schedule not found" }, 404)
    return c.json({ success: true })
  })
  .get("/properties", async (c) => {
    const query = await parseQuery(c, propertyListQuerySchema)
    return c.json(await facilitiesService.listProperties(c.get("db"), query))
  })
  .post("/properties", async (c) => {
    const row = await facilitiesService.createProperty(
      c.get("db"),
      await parseJsonBody(c, insertPropertySchema),
    )
    if (!row) return c.json({ error: "Facility not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/properties/:id", async (c) => {
    const row = await facilitiesService.getPropertyById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/properties/:id", async (c) => {
    const row = await facilitiesService.updateProperty(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePropertySchema),
    )
    if (!row) return c.json({ error: "Property not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/properties/:id", async (c) => {
    const row = await facilitiesService.deleteProperty(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property not found" }, 404)
    return c.json({ success: true })
  })
  .get("/property-groups", async (c) => {
    const query = await parseQuery(c, propertyGroupListQuerySchema)
    return c.json(await facilitiesService.listPropertyGroups(c.get("db"), query))
  })
  .post("/property-groups", async (c) => {
    const row = await facilitiesService.createPropertyGroup(
      c.get("db"),
      await parseJsonBody(c, insertPropertyGroupSchema),
    )
    return c.json({ data: row }, 201)
  })
  .get("/property-groups/:id", async (c) => {
    const row = await facilitiesService.getPropertyGroupById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property group not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/property-groups/:id", async (c) => {
    const row = await facilitiesService.updatePropertyGroup(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePropertyGroupSchema),
    )
    if (!row) return c.json({ error: "Property group not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/property-groups/:id", async (c) => {
    const row = await facilitiesService.deletePropertyGroup(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property group not found" }, 404)
    return c.json({ success: true })
  })
  .get("/property-group-members", async (c) => {
    const query = await parseQuery(c, propertyGroupMemberListQuerySchema)
    return c.json(await facilitiesService.listPropertyGroupMembers(c.get("db"), query))
  })
  .post("/property-group-members", async (c) => {
    const row = await facilitiesService.createPropertyGroupMember(
      c.get("db"),
      await parseJsonBody(c, insertPropertyGroupMemberSchema),
    )
    if (!row) return c.json({ error: "Property group or property not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/property-group-members/:id", async (c) => {
    const row = await facilitiesService.getPropertyGroupMemberById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property group member not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/property-group-members/:id", async (c) => {
    const row = await facilitiesService.updatePropertyGroupMember(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePropertyGroupMemberSchema),
    )
    if (!row) return c.json({ error: "Property group member not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/property-group-members/:id", async (c) => {
    const row = await facilitiesService.deletePropertyGroupMember(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Property group member not found" }, 404)
    return c.json({ success: true })
  })
  // Function spaces (meeting/event sub-spaces of a venue) — RFC voyant#1489 Phase 2.
  .get("/function-spaces", async (c) => {
    const query = await parseQuery(c, functionSpaceListQuerySchema)
    return c.json(await functionSpaceService.listFunctionSpaces(c.get("db"), query))
  })
  .post("/function-spaces", async (c) => {
    const body = await parseJsonBody(c, createFunctionSpaceSchema)
    const outcome = await functionSpaceService.createFunctionSpace(c.get("db"), body)
    if (outcome.status === "facility_not_found") return c.json({ error: "Facility not found" }, 404)
    if (outcome.status === "parent_not_found")
      return c.json({ error: "Parent space not found" }, 404)
    return c.json({ data: outcome.space }, 201)
  })
  .get("/function-spaces/:id", async (c) => {
    const row = await functionSpaceService.getFunctionSpace(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Function space not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/function-spaces/:id", async (c) => {
    const row = await functionSpaceService.updateFunctionSpace(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFunctionSpaceSchema),
    )
    if (!row) return c.json({ error: "Function space not found" }, 404)
    return c.json({ data: row })
  })
  .put("/function-spaces/:id/capacities", async (c) => {
    const id = c.req.param("id")
    const existing = await functionSpaceService.getFunctionSpace(c.get("db"), id)
    if (!existing) return c.json({ error: "Function space not found" }, 404)
    const { capacities } = await parseJsonBody(c, setFunctionSpaceCapacitiesSchema)
    return c.json({
      data: await functionSpaceService.setFunctionSpaceCapacities(c.get("db"), id, capacities),
    })
  })

export type FacilitiesRoutes = typeof facilitiesRoutes
export type PlacesRoutes = FacilitiesRoutes
export const placesRoutes = facilitiesRoutes
