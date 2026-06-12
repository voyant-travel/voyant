import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { csvDownload, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import { accountantSharesService } from "./service-accountant-shares.js"
import {
  buildDepartureProfitabilityCsv,
  buildProductProfitabilityCsv,
} from "./service-profitability.js"
import {
  agingReportQuerySchema,
  createAccountantShareSchema,
  departureProfitabilityQuerySchema,
  insertCostCategorySchema,
  productProfitabilityQuerySchema,
  profitabilityQuerySchema,
  revenueReportQuerySchema,
  travelerProfitabilityQuerySchema,
  updateCostCategorySchema,
} from "./validation.js"

export const financeReportRoutes = new Hono<Env>()

  // ========================================================================
  // Reports (static paths first)
  // ========================================================================

  // GET /reports/revenue — Revenue by month
  .get("/reports/revenue", async (c) => {
    const query = parseQuery(c, revenueReportQuerySchema)
    return c.json({ data: await financeService.getRevenueReport(c.get("db"), query) })
  })

  // GET /reports/aging — Outstanding invoices by age buckets
  .get("/reports/aging", async (c) => {
    const query = parseQuery(c, agingReportQuerySchema)
    return c.json({ data: await financeService.getAgingReport(c.get("db"), query) })
  })

  // GET /reports/profitability — Per-booking margin summary
  .get("/reports/profitability", async (c) => {
    const query = parseQuery(c, profitabilityQuerySchema)
    return c.json({ data: await financeService.getProfitabilityReport(c.get("db"), query) })
  })

  // GET /reports/profitability/departures — Per-departure P&L (RFC §8)
  .get("/reports/profitability/departures", async (c) => {
    const query = parseQuery(c, departureProfitabilityQuerySchema)
    return c.json({
      data: await financeService.getDepartureProfitability(
        c.get("db"),
        query,
        getFinanceRouteRuntime(c),
      ),
    })
  })

  // GET /reports/profitability/products — Per-product P&L roll-up (RFC §8)
  .get("/reports/profitability/products", async (c) => {
    const query = parseQuery(c, productProfitabilityQuerySchema)
    return c.json({
      data: await financeService.getProductProfitability(
        c.get("db"),
        query,
        getFinanceRouteRuntime(c),
      ),
    })
  })

  // GET /reports/profitability/travelers — Per-traveller P&L for one departure (RFC §6)
  .get("/reports/profitability/travelers", async (c) => {
    const query = parseQuery(c, travelerProfitabilityQuerySchema)
    return c.json({ data: await financeService.getTravelerProfitability(c.get("db"), query) })
  })

  // GET /reports/profitability/departures/export — CSV for accountant sharing
  .get("/reports/profitability/departures/export", async (c) => {
    const query = parseQuery(c, departureProfitabilityQuerySchema)
    const report = await financeService.getDepartureProfitability(
      c.get("db"),
      query,
      getFinanceRouteRuntime(c),
    )
    return csvDownload(buildDepartureProfitabilityCsv(report), "departure-profitability.csv")
  })

  // GET /reports/profitability/products/export — CSV for accountant sharing
  .get("/reports/profitability/products/export", async (c) => {
    const query = parseQuery(c, productProfitabilityQuerySchema)
    const report = await financeService.getProductProfitability(
      c.get("db"),
      query,
      getFinanceRouteRuntime(c),
    )
    return csvDownload(buildProductProfitabilityCsv(report), "product-profitability.csv")
  })

  // ----- Cost categories (operator-configurable cost classification) -----
  .get("/cost-categories", async (c) => {
    const includeArchived = c.req.query("includeArchived") === "true"
    return c.json({
      data: await financeService.costCategories.list(c.get("db"), { includeArchived }),
    })
  })
  .post("/cost-categories", async (c) => {
    const input = await parseJsonBody(c, insertCostCategorySchema)
    return c.json({ data: await financeService.costCategories.create(c.get("db"), input) }, 201)
  })
  .patch("/cost-categories/:id", async (c) => {
    const input = await parseJsonBody(c, updateCostCategorySchema)
    const row = await financeService.costCategories.update(c.get("db"), c.req.param("id"), input)
    if (!row) return c.json({ error: "Cost category not found" }, 404)
    return c.json({ data: row })
  })

  // ----- Accountant shares (revocable public finance-portal links, RFC §13.2) -----
  .get("/accountant-shares", async (c) => {
    return c.json({ data: await accountantSharesService.list(c.get("db")) })
  })
  .post("/accountant-shares", async (c) => {
    const input = await parseJsonBody(c, createAccountantShareSchema)
    const share = await accountantSharesService.create(c.get("db"), input, {
      publicBaseUrl: new URL(c.req.url).origin,
      userId: c.get("userId") ?? null,
    })
    return c.json({ data: share }, 201)
  })
  .post("/accountant-shares/:id/revoke", async (c) => {
    const revoked = await accountantSharesService.revoke(
      c.get("db"),
      c.req.param("id"),
      c.get("userId") ?? null,
    )
    if (!revoked) return c.json({ error: "Accountant share not found" }, 404)
    return c.json({ data: { id: revoked.id } })
  })
