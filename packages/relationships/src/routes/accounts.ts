import type { EventBus, ModuleContainer } from "@voyant-travel/core"
import {
  type CustomFieldDefinition,
  customFieldsVisibleIn,
  validateCustomFields,
} from "@voyant-travel/core/custom-fields"
import {
  idempotencyKey,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
  requireUserId,
} from "@voyant-travel/hono"
import {
  insertAddressSchema,
  insertContactPointSchema,
  updateAddressSchema,
  updateContactPointSchema,
} from "@voyant-travel/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { emitOrganizationChanged, emitPersonChanged } from "../events.js"
import {
  RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY,
  type RelationshipsRouteRuntime,
} from "../route-runtime.js"
import { RelationshipsMergeError } from "../service/accounts-merge.js"
import { relationshipsService } from "../service/index.js"
import {
  communicationListQuerySchema,
  insertCommunicationLogSchema,
  insertOrganizationNoteSchema,
  insertOrganizationSchema,
  insertPersonNoteSchema,
  insertPersonPaymentMethodSchema,
  insertPersonSchema,
  insertSegmentSchema,
  mergeOrganizationSchema,
  mergePersonSchema,
  organizationListQuerySchema,
  personListQuerySchema,
  updateOrganizationNoteSchema,
  updateOrganizationSchema,
  updatePersonNoteSchema,
  updatePersonPaymentMethodSchema,
  updatePersonSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    container?: ModuleContainer
    eventBus?: EventBus
  }
}

const organizationEntity = "organization" as const
const personEntity = "person" as const

function mergeErrorResponse(c: Context<Env>, error: unknown) {
  if (error instanceof RelationshipsMergeError) {
    return c.json({ error: error.message }, error.status)
  }
  throw error
}

/**
 * Validate a person/organization write's `customFields` against the resolved
 * custom-field registry (code ∪ runtime `custom_field_definitions`) and replace
 * the payload with the cleaned value. No-op when the write carries none. Rejects
 * (400) unknown keys / missing required / bad types, or any `customFields` when
 * the deployment declares none. See the custom-fields unification ADR.
 */
async function validateRelationshipsCustomFields<T extends Env>(
  c: Context<T>,
  entity: "person" | "organization",
  data: { customFields?: Record<string, unknown> },
  mode: "create" | "update",
): Promise<void> {
  const runtime = c.get("container")?.resolve(RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY) as
    | RelationshipsRouteRuntime
    | undefined
  const resolveRegistry = runtime?.customFields
  if (data.customFields === undefined) {
    // Partial update without custom fields, or no registry → no-op. A create with
    // an absent envelope still validates `{}` so `required` fields are enforced.
    if (mode === "update" || !resolveRegistry) {
      return
    }
  } else if (!resolveRegistry) {
    throw new RequestValidationError("Custom fields are not configured for this deployment", {
      fields: { fieldErrors: { customFields: ["not configured"] }, formErrors: [] },
    })
  }
  if (!resolveRegistry) {
    return
  }
  const result = validateCustomFields(
    await resolveRegistry(c.get("db")),
    entity,
    data.customFields ?? {},
  )
  if (!result.ok) {
    throw new RequestValidationError(`Invalid ${entity} custom fields`, {
      fields: {
        fieldErrors: Object.fromEntries(result.errors.map((e) => [e.key, [e.message]])),
        formErrors: [],
      },
    })
  }
  data.customFields = result.value
}

/** Custom fields for `entity` visible in `channel` (export / invoice / search). */
async function resolveVisibleCustomFields<T extends Env>(
  c: Context<T>,
  entity: "person" | "organization",
  channel: "export" | "invoice" | "search",
): Promise<CustomFieldDefinition[]> {
  const runtime = c.get("container")?.resolve(RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY) as
    | RelationshipsRouteRuntime
    | undefined
  const resolveRegistry = runtime?.customFields
  if (!resolveRegistry) return []
  return customFieldsVisibleIn(await resolveRegistry(c.get("db")), entity, channel)
}

export const accountRoutes = new Hono<Env>()
  // Organizations
  .get("/organizations", async (c) => {
    const query = parseQuery(c, organizationListQuerySchema)
    return c.json(await relationshipsService.listOrganizations(c.get("db"), query))
  })
  .post(
    "/organizations",
    idempotencyKey({ scope: "POST /v1/admin/relationships/organizations" }),
    async (c) => {
      const data = await parseJsonBody(c, insertOrganizationSchema)
      await validateRelationshipsCustomFields(c, organizationEntity, data, "create")
      const row = await relationshipsService.createOrganization(c.get("db"), data)
      if (row) await emitOrganizationChanged(c.get("eventBus"), { id: row.id, action: "created" })
      return c.json({ data: row }, 201)
    },
  )
  .get("/organizations/:id", async (c) => {
    const row = await relationshipsService.getOrganizationById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Organization not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/organizations/:id", async (c) => {
    const data = await parseJsonBody(c, updateOrganizationSchema)
    await validateRelationshipsCustomFields(c, organizationEntity, data, "update")
    const row = await relationshipsService.updateOrganization(c.get("db"), c.req.param("id"), data)
    if (!row) return c.json({ error: "Organization not found" }, 404)
    await emitOrganizationChanged(c.get("eventBus"), { id: row.id, action: "updated" })
    return c.json({ data: row })
  })
  .post("/organizations/:id/merge", async (c) => {
    try {
      const body = await parseJsonBody(c, mergeOrganizationSchema)
      const row = await relationshipsService.mergeOrganization(
        c.get("db"),
        c.req.param("id"),
        body.mergeId,
      )
      return c.json({ data: row })
    } catch (error) {
      return mergeErrorResponse(c, error)
    }
  })
  .delete("/organizations/:id", async (c) => {
    const row = await relationshipsService.deleteOrganization(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Organization not found" }, 404)
    await emitOrganizationChanged(c.get("eventBus"), { id: c.req.param("id"), action: "deleted" })
    return c.json({ success: true })
  })
  .get("/organizations/:id/contact-methods", async (c) => {
    return c.json({
      data: await relationshipsService.listContactMethods(
        c.get("db"),
        organizationEntity,
        c.req.param("id"),
      ),
    })
  })
  .post("/organizations/:id/contact-methods", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createContactMethod(
          c.get("db"),
          organizationEntity,
          c.req.param("id"),
          await parseJsonBody(c, insertContactPointSchema),
        ),
      },
      201,
    )
  })
  .get("/organizations/:id/addresses", async (c) => {
    return c.json({
      data: await relationshipsService.listAddresses(
        c.get("db"),
        organizationEntity,
        c.req.param("id"),
      ),
    })
  })
  .post("/organizations/:id/addresses", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createAddress(
          c.get("db"),
          organizationEntity,
          c.req.param("id"),
          await parseJsonBody(c, insertAddressSchema),
        ),
      },
      201,
    )
  })
  .get("/organizations/:id/notes", async (c) => {
    return c.json({
      data: await relationshipsService.listOrganizationNotes(c.get("db"), c.req.param("id")),
    })
  })
  .post("/organizations/:id/notes", async (c) => {
    const userId = requireUserId(c)
    const row = await relationshipsService.createOrganizationNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertOrganizationNoteSchema),
    )
    if (!row) return c.json({ error: "Organization not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/organization-notes/:id", async (c) => {
    const body = await parseJsonBody(c, updateOrganizationNoteSchema)
    const row = await relationshipsService.updateOrganizationNote(
      c.get("db"),
      c.req.param("id"),
      body.content,
    )
    if (!row) return c.json({ error: "Note not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/organization-notes/:id", async (c) => {
    const row = await relationshipsService.deleteOrganizationNote(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Note not found" }, 404)
    return c.json({ success: true })
  })

  // People
  .get("/people", async (c) => {
    const query = parseQuery(c, personListQuerySchema)
    const searchableFields = query.search
      ? await resolveVisibleCustomFields(c, personEntity, "search")
      : []
    return c.json(await relationshipsService.listPeople(c.get("db"), query, searchableFields))
  })
  .post("/people", idempotencyKey({ scope: "POST /v1/admin/relationships/people" }), async (c) => {
    const data = await parseJsonBody(c, insertPersonSchema)
    await validateRelationshipsCustomFields(c, personEntity, data, "create")
    const row = await relationshipsService.createPerson(c.get("db"), data)
    if (row) await emitPersonChanged(c.get("eventBus"), { id: row.id, action: "created" })
    return c.json({ data: row }, 201)
  })
  .get("/people/:id", async (c) => {
    const row = await relationshipsService.getPersonById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/people/:id", async (c) => {
    const data = await parseJsonBody(c, updatePersonSchema)
    await validateRelationshipsCustomFields(c, personEntity, data, "update")
    const row = await relationshipsService.updatePerson(c.get("db"), c.req.param("id"), data)
    if (!row) return c.json({ error: "Person not found" }, 404)
    await emitPersonChanged(c.get("eventBus"), { id: row.id, action: "updated" })
    return c.json({ data: row })
  })
  .post("/people/:id/merge", async (c) => {
    try {
      const body = await parseJsonBody(c, mergePersonSchema)
      const row = await relationshipsService.mergePerson(
        c.get("db"),
        c.req.param("id"),
        body.mergeId,
      )
      return c.json({ data: row })
    } catch (error) {
      return mergeErrorResponse(c, error)
    }
  })
  .delete("/people/:id", async (c) => {
    const row = await relationshipsService.deletePerson(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Person not found" }, 404)
    await emitPersonChanged(c.get("eventBus"), { id: c.req.param("id"), action: "deleted" })
    return c.json({ success: true })
  })
  .get("/people/:id/contact-methods", async (c) => {
    return c.json({
      data: await relationshipsService.listContactMethods(
        c.get("db"),
        personEntity,
        c.req.param("id"),
      ),
    })
  })
  .post("/people/:id/contact-methods", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createContactMethod(
          c.get("db"),
          personEntity,
          c.req.param("id"),
          await parseJsonBody(c, insertContactPointSchema),
        ),
      },
      201,
    )
  })
  .get("/people/:id/addresses", async (c) => {
    return c.json({
      data: await relationshipsService.listAddresses(c.get("db"), personEntity, c.req.param("id")),
    })
  })
  .post("/people/:id/addresses", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createAddress(
          c.get("db"),
          personEntity,
          c.req.param("id"),
          await parseJsonBody(c, insertAddressSchema),
        ),
      },
      201,
    )
  })
  .get("/people/:id/notes", async (c) => {
    return c.json({
      data: await relationshipsService.listPersonNotes(c.get("db"), c.req.param("id")),
    })
  })
  .post("/people/:id/notes", async (c) => {
    const userId = requireUserId(c)
    const row = await relationshipsService.createPersonNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertPersonNoteSchema),
    )
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/person-notes/:id", async (c) => {
    const body = await parseJsonBody(c, updatePersonNoteSchema)
    const row = await relationshipsService.updatePersonNote(
      c.get("db"),
      c.req.param("id"),
      body.content,
    )
    if (!row) return c.json({ error: "Note not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/person-notes/:id", async (c) => {
    const row = await relationshipsService.deletePersonNote(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Note not found" }, 404)
    return c.json({ success: true })
  })
  // Payment methods on file for a person.
  .get("/people/:id/payment-methods", async (c) => {
    return c.json({
      data: await relationshipsService.listPersonPaymentMethods(c.get("db"), c.req.param("id")),
    })
  })
  .post("/people/:id/payment-methods", async (c) => {
    const row = await relationshipsService.createPersonPaymentMethod(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertPersonPaymentMethodSchema),
    )
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/person-payment-methods/:id", async (c) => {
    const row = await relationshipsService.updatePersonPaymentMethod(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePersonPaymentMethodSchema),
    )
    if (!row) return c.json({ error: "Payment method not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/person-payment-methods/:id", async (c) => {
    const row = await relationshipsService.deletePersonPaymentMethod(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment method not found" }, 404)
    return c.json({ success: true })
  })
  .get("/people/:id/communications", async (c) => {
    const query = parseQuery(c, communicationListQuerySchema)
    return c.json({
      data: await relationshipsService.listCommunications(c.get("db"), c.req.param("id"), query),
    })
  })
  .post("/people/:id/communications", async (c) => {
    const row = await relationshipsService.createCommunication(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertCommunicationLogSchema),
    )
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })

  // Segments
  .get("/segments", async (c) => {
    return c.json({ data: await relationshipsService.listSegments(c.get("db")) })
  })
  .post("/segments", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createSegment(
          c.get("db"),
          await parseJsonBody(c, insertSegmentSchema),
        ),
      },
      201,
    )
  })
  .delete("/segments/:segmentId", async (c) => {
    const row = await relationshipsService.deleteSegment(c.get("db"), c.req.param("segmentId"))
    if (!row) return c.json({ error: "Segment not found" }, 404)
    return c.json({ success: true })
  })

  // CSV export/import
  .post("/people/export", async (c) => {
    const visibleFields = await resolveVisibleCustomFields(c, personEntity, "export")
    const csv = await relationshipsService.exportPeopleCsv(c.get("db"), visibleFields)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="people.csv"',
      },
    })
  })
  .post("/people/import", async (c) => {
    const result = await relationshipsService.importPeopleCsv(c.get("db"), await c.req.text())
    if ("error" in result) {
      return c.json({ error: result.error }, 400)
    }
    return c.json(result, 200)
  })

  // Shared contact method and address resources
  .patch("/contact-methods/:id", async (c) => {
    const row = await relationshipsService.updateContactMethod(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateContactPointSchema),
    )
    if (!row) return c.json({ error: "Contact method not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/contact-methods/:id", async (c) => {
    const row = await relationshipsService.deleteContactMethod(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Contact method not found" }, 404)
    return c.json({ success: true })
  })
  .patch("/addresses/:id", async (c) => {
    const row = await relationshipsService.updateAddress(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAddressSchema),
    )
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/addresses/:id", async (c) => {
    const row = await relationshipsService.deleteAddress(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ success: true })
  })
