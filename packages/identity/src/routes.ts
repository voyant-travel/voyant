import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { identityService } from "./service.js"
import {
  addressListQuerySchema,
  contactPointListQuerySchema,
  insertAddressForEntitySchema,
  insertAddressSchema,
  insertContactPointForEntitySchema,
  insertContactPointSchema,
  insertNamedContactForEntitySchema,
  insertNamedContactSchema,
  namedContactListQuerySchema,
  updateAddressSchema,
  updateContactPointSchema,
  updateNamedContactSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const identityRoutes = new Hono<Env>()
  .get("/named-contacts", async (c) => {
    const query = parseQuery(c, namedContactListQuerySchema)
    return c.json(await identityService.listNamedContacts(c.get("db"), query))
  })
  .post("/named-contacts", async (c) => {
    return c.json(
      {
        data: await identityService.createNamedContact(
          c.get("db"),
          await parseJsonBody(c, insertNamedContactSchema),
        ),
      },
      201,
    )
  })
  .get("/named-contacts/:id", async (c) => {
    const row = await identityService.getNamedContactById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Named contact not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/named-contacts/:id", async (c) => {
    const row = await identityService.updateNamedContact(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateNamedContactSchema),
    )
    if (!row) return c.json({ error: "Named contact not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/named-contacts/:id", async (c) => {
    const row = await identityService.deleteNamedContact(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Named contact not found" }, 404)
    return c.json({ success: true })
  })
  .get("/contact-points", async (c) => {
    const query = parseQuery(c, contactPointListQuerySchema)
    return c.json(await identityService.listContactPoints(c.get("db"), query))
  })
  .post("/contact-points", async (c) => {
    return c.json(
      {
        data: await identityService.createContactPoint(
          c.get("db"),
          await parseJsonBody(c, insertContactPointSchema),
        ),
      },
      201,
    )
  })
  .get("/contact-points/:id", async (c) => {
    const row = await identityService.getContactPointById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Contact point not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/contact-points/:id", async (c) => {
    const row = await identityService.updateContactPoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateContactPointSchema),
    )
    if (!row) return c.json({ error: "Contact point not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/contact-points/:id", async (c) => {
    const row = await identityService.deleteContactPoint(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Contact point not found" }, 404)
    return c.json({ success: true })
  })
  .get("/addresses", async (c) => {
    const query = parseQuery(c, addressListQuerySchema)
    return c.json(await identityService.listAddresses(c.get("db"), query))
  })
  .post("/addresses", async (c) => {
    return c.json(
      {
        data: await identityService.createAddress(
          c.get("db"),
          await parseJsonBody(c, insertAddressSchema),
        ),
      },
      201,
    )
  })
  .get("/addresses/:id", async (c) => {
    const row = await identityService.getAddressById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/addresses/:id", async (c) => {
    const row = await identityService.updateAddress(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAddressSchema),
    )
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/addresses/:id", async (c) => {
    const row = await identityService.deleteAddress(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Address not found" }, 404)
    return c.json({ success: true })
  })
  .get("/entities/:entityType/:entityId/contact-points", async (c) => {
    const params = c.req.param()
    return c.json({
      data: await identityService.listContactPointsForEntity(
        c.get("db"),
        params.entityType,
        params.entityId,
      ),
    })
  })
  .post("/entities/:entityType/:entityId/contact-points", async (c) => {
    const params = c.req.param()
    const body = await parseJsonBody(c, insertContactPointForEntitySchema)
    return c.json(
      {
        data: await identityService.createContactPoint(c.get("db"), {
          ...body,
          entityType: params.entityType,
          entityId: params.entityId,
        }),
      },
      201,
    )
  })
  .get("/entities/:entityType/:entityId/addresses", async (c) => {
    const params = c.req.param()
    return c.json({
      data: await identityService.listAddressesForEntity(
        c.get("db"),
        params.entityType,
        params.entityId,
      ),
    })
  })
  .post("/entities/:entityType/:entityId/addresses", async (c) => {
    const params = c.req.param()
    const body = await parseJsonBody(c, insertAddressForEntitySchema)
    return c.json(
      {
        data: await identityService.createAddress(c.get("db"), {
          ...body,
          entityType: params.entityType,
          entityId: params.entityId,
        }),
      },
      201,
    )
  })
  .get("/entities/:entityType/:entityId/named-contacts", async (c) => {
    const params = c.req.param()
    return c.json({
      data: await identityService.listNamedContactsForEntity(
        c.get("db"),
        params.entityType,
        params.entityId,
      ),
    })
  })
  .post("/entities/:entityType/:entityId/named-contacts", async (c) => {
    const params = c.req.param()
    const body = await parseJsonBody(c, insertNamedContactForEntitySchema)
    return c.json(
      {
        data: await identityService.createNamedContact(c.get("db"), {
          ...body,
          entityType: params.entityType,
          entityId: params.entityId,
        }),
      },
      201,
    )
  })

export type IdentityRoutes = typeof identityRoutes
