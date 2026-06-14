import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { type Env, notFound } from "./routes-shared.js"
import { pricingService } from "./service.js"
import {
  cancellationPolicyListQuerySchema,
  cancellationPolicyRuleListQuerySchema,
  insertCancellationPolicyRuleSchema,
  insertCancellationPolicySchema,
  insertPriceCatalogSchema,
  insertPriceScheduleSchema,
  insertPricingCategoryDependencySchema,
  insertPricingCategorySchema,
  priceCatalogListQuerySchema,
  priceScheduleListQuerySchema,
  pricingCategoryDependencyListQuerySchema,
  pricingCategoryListQuerySchema,
  updateCancellationPolicyRuleSchema,
  updateCancellationPolicySchema,
  updatePriceCatalogSchema,
  updatePriceScheduleSchema,
  updatePricingCategoryDependencySchema,
  updatePricingCategorySchema,
} from "./validation.js"

export const pricingCoreRoutes = new Hono<Env>()
  .get("/pricing-categories", async (c) =>
    c.json(
      await pricingService.listPricingCategories(
        c.get("db"),
        await parseQuery(c, pricingCategoryListQuerySchema),
      ),
    ),
  )
  .post("/pricing-categories", async (c) =>
    c.json(
      {
        data: await pricingService.createPricingCategory(
          c.get("db"),
          await parseJsonBody(c, insertPricingCategorySchema),
        ),
      },
      201,
    ),
  )
  .get("/pricing-categories/:id", async (c) => {
    const row = await pricingService.getPricingCategoryById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Pricing category not found")
  })
  .patch("/pricing-categories/:id", async (c) => {
    const row = await pricingService.updatePricingCategory(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePricingCategorySchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Pricing category not found")
  })
  .delete("/pricing-categories/:id", async (c) => {
    const row = await pricingService.deletePricingCategory(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Pricing category not found")
  })
  .get("/pricing-category-dependencies", async (c) =>
    c.json(
      await pricingService.listPricingCategoryDependencies(
        c.get("db"),
        await parseQuery(c, pricingCategoryDependencyListQuerySchema),
      ),
    ),
  )
  .post("/pricing-category-dependencies", async (c) =>
    c.json(
      {
        data: await pricingService.createPricingCategoryDependency(
          c.get("db"),
          await parseJsonBody(c, insertPricingCategoryDependencySchema),
        ),
      },
      201,
    ),
  )
  .get("/pricing-category-dependencies/:id", async (c) => {
    const row = await pricingService.getPricingCategoryDependencyById(
      c.get("db"),
      c.req.param("id"),
    )
    return row ? c.json({ data: row }) : notFound(c, "Pricing category dependency not found")
  })
  .patch("/pricing-category-dependencies/:id", async (c) => {
    const row = await pricingService.updatePricingCategoryDependency(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePricingCategoryDependencySchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Pricing category dependency not found")
  })
  .delete("/pricing-category-dependencies/:id", async (c) => {
    const row = await pricingService.deletePricingCategoryDependency(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Pricing category dependency not found")
  })
  .get("/cancellation-policies", async (c) =>
    c.json(
      await pricingService.listCancellationPolicies(
        c.get("db"),
        await parseQuery(c, cancellationPolicyListQuerySchema),
      ),
    ),
  )
  .post("/cancellation-policies", async (c) =>
    c.json(
      {
        data: await pricingService.createCancellationPolicy(
          c.get("db"),
          await parseJsonBody(c, insertCancellationPolicySchema),
        ),
      },
      201,
    ),
  )
  .get("/cancellation-policies/:id", async (c) => {
    const row = await pricingService.getCancellationPolicyById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Cancellation policy not found")
  })
  .patch("/cancellation-policies/:id", async (c) => {
    const row = await pricingService.updateCancellationPolicy(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateCancellationPolicySchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Cancellation policy not found")
  })
  .delete("/cancellation-policies/:id", async (c) => {
    const row = await pricingService.deleteCancellationPolicy(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Cancellation policy not found")
  })
  .get("/cancellation-policy-rules", async (c) =>
    c.json(
      await pricingService.listCancellationPolicyRules(
        c.get("db"),
        await parseQuery(c, cancellationPolicyRuleListQuerySchema),
      ),
    ),
  )
  .post("/cancellation-policy-rules", async (c) =>
    c.json(
      {
        data: await pricingService.createCancellationPolicyRule(
          c.get("db"),
          await parseJsonBody(c, insertCancellationPolicyRuleSchema),
        ),
      },
      201,
    ),
  )
  .get("/cancellation-policy-rules/:id", async (c) => {
    const row = await pricingService.getCancellationPolicyRuleById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Cancellation policy rule not found")
  })
  .patch("/cancellation-policy-rules/:id", async (c) => {
    const row = await pricingService.updateCancellationPolicyRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateCancellationPolicyRuleSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Cancellation policy rule not found")
  })
  .delete("/cancellation-policy-rules/:id", async (c) => {
    const row = await pricingService.deleteCancellationPolicyRule(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Cancellation policy rule not found")
  })
  .get("/price-catalogs", async (c) =>
    c.json(
      await pricingService.listPriceCatalogs(
        c.get("db"),
        await parseQuery(c, priceCatalogListQuerySchema),
      ),
    ),
  )
  .post("/price-catalogs", async (c) =>
    c.json(
      {
        data: await pricingService.createPriceCatalog(
          c.get("db"),
          await parseJsonBody(c, insertPriceCatalogSchema),
        ),
      },
      201,
    ),
  )
  .get("/price-catalogs/:id", async (c) => {
    const row = await pricingService.getPriceCatalogById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Price catalog not found")
  })
  .patch("/price-catalogs/:id", async (c) => {
    const row = await pricingService.updatePriceCatalog(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePriceCatalogSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Price catalog not found")
  })
  .delete("/price-catalogs/:id", async (c) => {
    const row = await pricingService.deletePriceCatalog(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Price catalog not found")
  })
  .get("/price-schedules", async (c) =>
    c.json(
      await pricingService.listPriceSchedules(
        c.get("db"),
        await parseQuery(c, priceScheduleListQuerySchema),
      ),
    ),
  )
  .post("/price-schedules", async (c) =>
    c.json(
      {
        data: await pricingService.createPriceSchedule(
          c.get("db"),
          await parseJsonBody(c, insertPriceScheduleSchema),
        ),
      },
      201,
    ),
  )
  .get("/price-schedules/:id", async (c) => {
    const row = await pricingService.getPriceScheduleById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Price schedule not found")
  })
  .patch("/price-schedules/:id", async (c) => {
    const row = await pricingService.updatePriceSchedule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePriceScheduleSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Price schedule not found")
  })
  .delete("/price-schedules/:id", async (c) => {
    const row = await pricingService.deletePriceSchedule(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Price schedule not found")
  })
