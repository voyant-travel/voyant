import {
  aggregateSnapshotKey,
  readThroughAggregateSnapshot,
} from "@voyant-travel/db/aggregate-snapshots"
import { parseJsonBody, parseQuery, requireUserId } from "@voyant-travel/hono"
import {
  insertAddressForEntitySchema,
  insertContactPointForEntitySchema,
  insertNamedContactForEntitySchema,
  updateAddressSchema as updateIdentityAddressSchema,
  updateContactPointSchema as updateIdentityContactPointSchema,
  updateNamedContactSchema as updateIdentityNamedContactSchema,
} from "@voyant-travel/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import { suppliersService } from "./service.js"
import {
  availabilityQuerySchema,
  insertAvailabilitySchema,
  insertContractSchema,
  insertRateSchema,
  insertServiceSchema,
  insertSupplierNoteSchema,
  insertSupplierSchema,
  supplierAggregatesQuerySchema,
  supplierListQuerySchema,
  updateContractSchema,
  updateRateSchema,
  updateServiceSchema,
  updateSupplierSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const DASHBOARD_AGGREGATES_CACHE_CONTROL = "private, max-age=30"

/** Server-side snapshot TTL — see readThroughAggregateSnapshot (#1629). */
const DASHBOARD_AGGREGATES_TTL_SECONDS = 60

function cacheDashboardAggregates(c: {
  header: (name: string, value: string, options?: { append?: boolean }) => void
}) {
  c.header("Cache-Control", DASHBOARD_AGGREGATES_CACHE_CONTROL)
  c.header("Vary", "Authorization", { append: true })
  c.header("Vary", "Cookie", { append: true })
}

// ==========================================================================
// Suppliers — method-chained for Hono RPC type inference
// ==========================================================================

export const supplierRoutes = new Hono<Env>()

  // ========================================================================
  // Dashboard aggregates
  // ========================================================================

  // GET /aggregates — dashboard KPIs (before /:id so the matcher doesn't
  // swallow it). Served from a read-through TTL snapshot (#1629).
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, supplierAggregatesQuerySchema)
    cacheDashboardAggregates(c)
    const snapshot = await readThroughAggregateSnapshot(c.get("db"), {
      key: aggregateSnapshotKey("suppliers", "aggregates", query),
      ttlSeconds: DASHBOARD_AGGREGATES_TTL_SECONDS,
      compute: () => suppliersService.getSupplierAggregates(c.get("db"), query),
    })
    return c.json({ data: snapshot.data })
  })

  // ========================================================================
  // Suppliers CRUD
  // ========================================================================

  // GET / — List suppliers
  .get("/", async (c) => {
    const query = parseQuery(c, supplierListQuerySchema)
    return c.json(await suppliersService.listSuppliers(c.get("db"), query))
  })

  // PATCH /contact-points/:contactPointId — Update supplier contact point
  .patch("/contact-points/:contactPointId", async (c) => {
    const row = await suppliersService.updateContactPoint(
      c.get("db"),
      c.req.param("contactPointId"),
      await parseJsonBody(c, updateIdentityContactPointSchema),
    )

    if (!row) {
      return c.json({ error: "Contact point not found" }, 404)
    }

    return c.json({ data: row })
  })

  // PATCH /contacts/:contactId — Update supplier named contact
  .patch("/contacts/:contactId", async (c) => {
    const row = await suppliersService.updateNamedContact(
      c.get("db"),
      c.req.param("contactId"),
      await parseJsonBody(c, updateIdentityNamedContactSchema),
    )

    if (!row) {
      return c.json({ error: "Contact not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /contacts/:contactId — Delete supplier named contact
  .delete("/contacts/:contactId", async (c) => {
    const row = await suppliersService.deleteNamedContact(c.get("db"), c.req.param("contactId"))

    if (!row) {
      return c.json({ error: "Contact not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // DELETE /contact-points/:contactPointId — Delete supplier contact point
  .delete("/contact-points/:contactPointId", async (c) => {
    const row = await suppliersService.deleteContactPoint(
      c.get("db"),
      c.req.param("contactPointId"),
    )

    if (!row) {
      return c.json({ error: "Contact point not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // PATCH /addresses/:addressId — Update supplier address
  .patch("/addresses/:addressId", async (c) => {
    const row = await suppliersService.updateAddress(
      c.get("db"),
      c.req.param("addressId"),
      await parseJsonBody(c, updateIdentityAddressSchema),
    )

    if (!row) {
      return c.json({ error: "Address not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /addresses/:addressId — Delete supplier address
  .delete("/addresses/:addressId", async (c) => {
    const row = await suppliersService.deleteAddress(c.get("db"), c.req.param("addressId"))

    if (!row) {
      return c.json({ error: "Address not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // GET /:id — Get single supplier
  .get("/:id", async (c) => {
    const row = await suppliersService.getSupplierById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST / — Create supplier
  .post("/", async (c) => {
    const data = await parseJsonBody(c, insertSupplierSchema)
    return c.json({ data: await suppliersService.createSupplier(c.get("db"), data) }, 201)
  })

  // PATCH /:id — Update supplier
  .patch("/:id", async (c) => {
    const row = await suppliersService.updateSupplier(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateSupplierSchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /:id — Delete supplier
  .delete("/:id", async (c) => {
    const row = await suppliersService.deleteSupplier(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // GET /:id/contact-points — List shared contact points for a supplier
  .get("/:id/contact-points", async (c) => {
    return c.json({
      data: await suppliersService.listContactPoints(c.get("db"), c.req.param("id")),
    })
  })

  // POST /:id/contact-points — Create shared contact point for a supplier
  .post("/:id/contact-points", async (c) => {
    const row = await suppliersService.createContactPoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertContactPointForEntitySchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // GET /:id/contacts — List shared named contacts for a supplier
  .get("/:id/contacts", async (c) => {
    return c.json({
      data: await suppliersService.listNamedContacts(c.get("db"), c.req.param("id")),
    })
  })

  // POST /:id/contacts — Create shared named contact for a supplier
  .post("/:id/contacts", async (c) => {
    const row = await suppliersService.createNamedContact(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertNamedContactForEntitySchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // GET /:id/addresses — List shared addresses for a supplier
  .get("/:id/addresses", async (c) => {
    return c.json({ data: await suppliersService.listAddresses(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/addresses — Create shared address for a supplier
  .post("/:id/addresses", async (c) => {
    const row = await suppliersService.createAddress(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertAddressForEntitySchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Services
  // ========================================================================

  // GET /:id/services — List services for a supplier
  .get("/:id/services", async (c) => {
    return c.json({ data: await suppliersService.listServices(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/services — Add service to supplier
  .post("/:id/services", async (c) => {
    const row = await suppliersService.createService(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertServiceSchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /:id/services/:serviceId — Update service
  .patch("/:id/services/:serviceId", async (c) => {
    const row = await suppliersService.updateService(
      c.get("db"),
      c.req.param("serviceId"),
      await parseJsonBody(c, updateServiceSchema),
    )

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /:id/services/:serviceId — Delete service
  .delete("/:id/services/:serviceId", async (c) => {
    const row = await suppliersService.deleteService(c.get("db"), c.req.param("serviceId"))

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Rates
  // ========================================================================

  // GET /:id/services/:serviceId/rates — List rates for a service
  .get("/:id/services/:serviceId/rates", async (c) => {
    return c.json({
      data: await suppliersService.listRates(c.get("db"), c.req.param("serviceId")),
    })
  })

  // POST /:id/services/:serviceId/rates — Add rate to service
  .post("/:id/services/:serviceId/rates", async (c) => {
    const row = await suppliersService.createRate(
      c.get("db"),
      c.req.param("serviceId"),
      await parseJsonBody(c, insertRateSchema),
    )

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /:id/services/:serviceId/rates/:rateId — Update rate
  .patch("/:id/services/:serviceId/rates/:rateId", async (c) => {
    const row = await suppliersService.updateRate(
      c.get("db"),
      c.req.param("rateId"),
      await parseJsonBody(c, updateRateSchema),
    )

    if (!row) {
      return c.json({ error: "Rate not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /:id/services/:serviceId/rates/:rateId — Delete rate
  .delete("/:id/services/:serviceId/rates/:rateId", async (c) => {
    const row = await suppliersService.deleteRate(c.get("db"), c.req.param("rateId"))

    if (!row) {
      return c.json({ error: "Rate not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Notes
  // ========================================================================

  // GET /:id/notes — List notes for supplier
  .get("/:id/notes", async (c) => {
    return c.json({ data: await suppliersService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/notes — Add note to supplier
  .post("/:id/notes", async (c) => {
    const userId = requireUserId(c)

    const row = await suppliersService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertSupplierNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Availability
  // ========================================================================

  // GET /:id/availability — List availability entries
  .get("/:id/availability", async (c) => {
    const query = parseQuery(c, availabilityQuerySchema)
    return c.json({
      data: await suppliersService.listAvailability(c.get("db"), c.req.param("id"), query),
    })
  })

  // POST /:id/availability — Add availability entries (bulk)
  .post("/:id/availability", async (c) => {
    const body = await parseJsonBody(
      c,
      z.union([z.array(insertAvailabilitySchema), insertAvailabilitySchema]),
    )
    const entries = Array.isArray(body) ? body : [body]
    const row = await suppliersService.createAvailability(c.get("db"), c.req.param("id"), entries)

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Contracts
  // ========================================================================

  // GET /:id/contracts — List contracts
  .get("/:id/contracts", async (c) => {
    return c.json({ data: await suppliersService.listContracts(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/contracts — Create contract
  .post("/:id/contracts", async (c) => {
    const row = await suppliersService.createContract(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertContractSchema),
    )

    if (!row) {
      return c.json({ error: "Supplier not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /:id/contracts/:contractId — Update contract
  .patch("/:id/contracts/:contractId", async (c) => {
    const row = await suppliersService.updateContract(
      c.get("db"),
      c.req.param("contractId"),
      await parseJsonBody(c, updateContractSchema),
    )

    if (!row) {
      return c.json({ error: "Contract not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /:id/contracts/:contractId — Delete contract
  .delete("/:id/contracts/:contractId", async (c) => {
    const row = await suppliersService.deleteContract(c.get("db"), c.req.param("contractId"))

    if (!row) {
      return c.json({ error: "Contract not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

export type SupplierRoutes = typeof supplierRoutes
