import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { legalTermsService } from "./service.js"
import {
  insertLegalTermSchema,
  legalTermListQuerySchema,
  updateLegalTermSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const PUBLIC_LEGAL_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

function cachePublicLegalRead(c: Context) {
  c.header("Cache-Control", PUBLIC_LEGAL_CACHE_CONTROL)
}

export const legalTermsAdminRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = parseQuery(c, legalTermListQuerySchema)
    return c.json(await legalTermsService.listTerms(c.get("db"), query))
  })
  .post("/", async (c) => {
    const row = await legalTermsService.createTerm(
      c.get("db"),
      await parseJsonBody(c, insertLegalTermSchema),
    )
    return c.json({ data: row }, 201)
  })
  .get("/:id", async (c) => {
    const row = await legalTermsService.getTermById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Legal term not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/:id", async (c) => {
    const row = await legalTermsService.updateTerm(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateLegalTermSchema),
    )
    if (!row) return c.json({ error: "Legal term not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/:id", async (c) => {
    const row = await legalTermsService.deleteTerm(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Legal term not found" }, 404)
    return c.json({ success: true })
  })

export type LegalTermsAdminRoutes = typeof legalTermsAdminRoutes

export const legalTermsPublicRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = parseQuery(c, legalTermListQuerySchema)
    const result = await legalTermsService.listTerms(c.get("db"), query)
    cachePublicLegalRead(c)
    return c.json(result)
  })
  .get("/:id", async (c) => {
    const row = await legalTermsService.getTermById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Legal term not found" }, 404)
    cachePublicLegalRead(c)
    return c.json({ data: row })
  })

export type LegalTermsPublicRoutes = typeof legalTermsPublicRoutes
