import type { ModuleContainer } from "@voyantjs/core"
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { encryptOptionalJsonEnvelope } from "@voyantjs/utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"

import { CRM_ROUTE_RUNTIME_CONTAINER_KEY, type CrmRouteRuntime } from "../route-runtime.js"
import { people } from "../schema.js"
import { crmService } from "../service/index.js"
import {
  insertPersonDocumentFromPlaintextSchema,
  insertPersonDocumentSchema,
  personDocumentListQuerySchema,
  updatePersonDocumentFromPlaintextSchema,
  updatePersonDocumentSchema,
  updatePersonProfilePiiSchema,
} from "../validation.js"

type Env = {
  Variables: {
    container?: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

const peopleKeyRef = { keyType: "people" as const }

async function getCrmKms(c: Context<Env>) {
  const runtime = c.var.container?.resolve<CrmRouteRuntime>(CRM_ROUTE_RUNTIME_CONTAINER_KEY)
  if (!runtime) return null
  return runtime.getKmsProvider()
}

function kmsRequired(c: Context<Env>) {
  return c.json(
    { error: "KMS provider not configured — admin PII routes require a wired KMS key" },
    503,
  )
}

export const personDocumentRoutes = new Hono<Env>()
  .get("/people/:id/documents", async (c) => {
    const query = parseQuery(c, personDocumentListQuerySchema)
    return c.json({
      data: await crmService.listPersonDocuments(c.get("db"), c.req.param("id"), query),
    })
  })
  .post("/people/:id/documents", async (c) => {
    const row = await crmService.createPersonDocument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertPersonDocumentSchema),
    )
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/person-documents/:id", async (c) => {
    const row = await crmService.getPersonDocument(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Document not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/person-documents/:id", async (c) => {
    const row = await crmService.updatePersonDocument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePersonDocumentSchema),
    )
    if (!row) return c.json({ error: "Document not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/person-documents/:id", async (c) => {
    const row = await crmService.deletePersonDocument(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Document not found" }, 404)
    return c.json({ success: true })
  })
  .post("/person-documents/:id/set-primary", async (c) => {
    const row = await crmService.setPrimaryPersonDocument(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Document not found" }, 404)
    return c.json({ data: row })
  })

  // ── Admin PII conveniences (server-side encrypt/decrypt) ──────────────
  // Operator UIs (booking-traveler dialog) need to read a person's
  // primary passport + free-text PII in plaintext to pre-fill forms,
  // and write changes back without round-tripping ciphertext through
  // the browser. Endpoints below use the request-scoped CRM runtime
  // to access the people KMS key.

  /**
   * Decrypted snapshot of a person's primary passport + dietary +
   * accessibility values. Used by the booking-traveler dialog to
   * pre-fill snapshot fields when an operator picks an existing
   * person. Returns 404 when person missing, 503 when KMS unwired.
   */
  .get("/people/:id/travel-snapshot", async (c) => {
    const kms = await getCrmKms(c)
    if (!kms) return kmsRequired(c)
    const snapshot = await crmService.loadPersonTravelSnapshot(c.get("db"), c.req.param("id"), {
      kms,
    })
    if (!snapshot) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: snapshot })
  })

  /**
   * Plaintext PATCH for the four free-text PII slots on
   * `crm.people`. The route encrypts each provided value server-side
   * with the people KMS key. `null` clears a slot.
   */
  .patch("/people/:id/profile-pii", async (c) => {
    const kms = await getCrmKms(c)
    if (!kms) return kmsRequired(c)
    const body = await parseJsonBody(c, updatePersonProfilePiiSchema)

    const updates: Record<string, { enc: string } | null> = {}
    for (const [key, column] of [
      ["accessibility", "accessibilityEncrypted"],
      ["dietary", "dietaryEncrypted"],
      ["loyalty", "loyaltyEncrypted"],
      ["insurance", "insuranceEncrypted"],
    ] as const) {
      const value = body[key]
      if (value === undefined) continue
      if (value === null) {
        updates[column] = null
      } else {
        updates[column] = await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { text: value })
      }
    }
    if (Object.keys(updates).length === 0) {
      return c.json({ error: "Nothing to update" }, 400)
    }

    const [row] = await c
      .get("db")
      .update(people)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(people.id, c.req.param("id")))
      .returning({ id: people.id })
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ success: true })
  })

  /**
   * Plaintext document create — accepts `number` as cleartext, the
   * route encrypts via the people KMS key. Mirrors the existing
   * `POST /people/:id/documents` shape but spares clients from
   * holding KMS material.
   */
  .post("/people/:id/documents/from-plaintext", async (c) => {
    const kms = await getCrmKms(c)
    if (!kms) return kmsRequired(c)
    const body = await parseJsonBody(c, insertPersonDocumentFromPlaintextSchema)
    const { number, ...rest } = body
    const numberEncrypted =
      number == null ? null : await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { number })
    const row = await crmService.createPersonDocument(c.get("db"), c.req.param("id"), {
      ...rest,
      ...(numberEncrypted !== undefined ? { numberEncrypted } : {}),
    })
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })

  /**
   * Plaintext document update — same encryption convention as the
   * create variant. Only fields explicitly provided are written;
   * `number: null` clears the encrypted slot.
   */
  .patch("/person-documents/:id/from-plaintext", async (c) => {
    const kms = await getCrmKms(c)
    if (!kms) return kmsRequired(c)
    const body = await parseJsonBody(c, updatePersonDocumentFromPlaintextSchema)
    const { number, ...rest } = body
    const updateInput: Record<string, unknown> = { ...rest }
    if (number !== undefined) {
      updateInput.numberEncrypted =
        number === null ? null : await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { number })
    }
    const row = await crmService.updatePersonDocument(c.get("db"), c.req.param("id"), updateInput)
    if (!row) return c.json({ error: "Document not found" }, 404)
    return c.json({ data: row })
  })
