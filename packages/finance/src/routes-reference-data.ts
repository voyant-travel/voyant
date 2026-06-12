import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import {
  insertInvoiceNumberSeriesSchema,
  insertInvoiceTemplateSchema,
  insertTaxClassSchema,
  insertTaxPolicyProfileSchema,
  insertTaxPolicyRuleSchema,
  insertTaxRegimeSchema,
  invoiceNumberSeriesListQuerySchema,
  invoiceTemplateListQuerySchema,
  taxClassListQuerySchema,
  taxPolicyProfileListQuerySchema,
  taxPolicyRuleListQuerySchema,
  taxRegimeListQuerySchema,
  updateInvoiceNumberSeriesSchema,
  updateInvoiceTemplateSchema,
  updateTaxClassSchema,
  updateTaxPolicyProfileSchema,
  updateTaxPolicyRuleSchema,
  updateTaxRegimeSchema,
} from "./validation.js"

export const financeReferenceDataRoutes = new Hono<Env>()

  // ========================================================================
  // Invoice Number Series
  // ========================================================================

  .get("/invoice-number-series", async (c) => {
    const query = parseQuery(c, invoiceNumberSeriesListQuerySchema)
    return c.json(await financeService.listInvoiceNumberSeries(c.get("db"), query))
  })

  .post("/invoice-number-series", async (c) => {
    const row = await financeService.createInvoiceNumberSeries(
      c.get("db"),
      await parseJsonBody(c, insertInvoiceNumberSeriesSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/invoice-number-series/:id", async (c) => {
    const row = await financeService.getInvoiceNumberSeriesById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/invoice-number-series/:id", async (c) => {
    const row = await financeService.updateInvoiceNumberSeries(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceNumberSeriesSchema),
    )
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/invoice-number-series/:id", async (c) => {
    const row = await financeService.deleteInvoiceNumberSeries(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ success: true })
  })

  .post("/invoice-number-series/:id/allocate", async (c) => {
    const result = await financeService.allocateInvoiceNumber(c.get("db"), c.req.param("id"))
    if (result.status === "not_found") {
      return c.json({ error: "Invoice number series not found" }, 404)
    }
    if (result.status === "inactive") {
      return c.json({ error: "Invoice number series is inactive" }, 409)
    }
    return c.json({
      data: { sequence: result.sequence, formattedNumber: result.formattedNumber },
    })
  })

  // ========================================================================
  // Invoice Templates
  // ========================================================================

  .get("/invoice-templates", async (c) => {
    const query = parseQuery(c, invoiceTemplateListQuerySchema)
    return c.json(await financeService.listInvoiceTemplates(c.get("db"), query))
  })

  .post("/invoice-templates", async (c) => {
    const row = await financeService.createInvoiceTemplate(
      c.get("db"),
      await parseJsonBody(c, insertInvoiceTemplateSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/invoice-templates/:id", async (c) => {
    const row = await financeService.getInvoiceTemplateById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/invoice-templates/:id", async (c) => {
    const row = await financeService.updateInvoiceTemplate(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceTemplateSchema),
    )
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/invoice-templates/:id", async (c) => {
    const row = await financeService.deleteInvoiceTemplate(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Regimes
  // ========================================================================

  .get("/tax-regimes", async (c) => {
    const query = parseQuery(c, taxRegimeListQuerySchema)
    return c.json(await financeService.listTaxRegimes(c.get("db"), query))
  })

  .post("/tax-regimes", async (c) => {
    const row = await financeService.createTaxRegime(
      c.get("db"),
      await parseJsonBody(c, insertTaxRegimeSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-regimes/:id", async (c) => {
    const row = await financeService.getTaxRegimeById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-regimes/:id", async (c) => {
    const row = await financeService.updateTaxRegime(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxRegimeSchema),
    )
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-regimes/:id", async (c) => {
    const row = await financeService.deleteTaxRegime(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Classes
  // ========================================================================

  .get("/tax-classes", async (c) => {
    const query = parseQuery(c, taxClassListQuerySchema)
    return c.json(await financeService.listTaxClasses(c.get("db"), query))
  })

  .post("/tax-classes", async (c) => {
    const row = await financeService.createTaxClass(
      c.get("db"),
      await parseJsonBody(c, insertTaxClassSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-classes/:id", async (c) => {
    const row = await financeService.getTaxClassById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-classes/:id", async (c) => {
    const row = await financeService.updateTaxClass(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxClassSchema),
    )
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-classes/:id", async (c) => {
    const row = await financeService.deleteTaxClass(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Policy Profiles
  // ========================================================================

  .get("/tax-policy-profiles", async (c) => {
    const query = parseQuery(c, taxPolicyProfileListQuerySchema)
    return c.json(await financeService.listTaxPolicyProfiles(c.get("db"), query))
  })

  .post("/tax-policy-profiles", async (c) => {
    const row = await financeService.createTaxPolicyProfile(
      c.get("db"),
      await parseJsonBody(c, insertTaxPolicyProfileSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.getTaxPolicyProfileById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.updateTaxPolicyProfile(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxPolicyProfileSchema),
    )
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.deleteTaxPolicyProfile(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Policy Rules
  // ========================================================================

  .get("/tax-policy-rules", async (c) => {
    const query = parseQuery(c, taxPolicyRuleListQuerySchema)
    return c.json(await financeService.listTaxPolicyRules(c.get("db"), query))
  })

  .post("/tax-policy-rules", async (c) => {
    const row = await financeService.createTaxPolicyRule(
      c.get("db"),
      await parseJsonBody(c, insertTaxPolicyRuleSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.getTaxPolicyRuleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.updateTaxPolicyRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxPolicyRuleSchema),
    )
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.deleteTaxPolicyRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ success: true })
  })
