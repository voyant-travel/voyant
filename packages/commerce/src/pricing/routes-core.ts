/**
 * Admin CRUD routes for the pricing core resources — mounted by the operator
 * starter under `/v1/admin/...` (staff-actor-gated by the parent app's
 * middleware chain). Covers six resources: pricing-categories,
 * pricing-category-dependencies, cancellation-policies,
 * cancellation-policy-rules, price-catalogs, price-schedules.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208). Request schemas reuse the existing `validation.ts` schemas the
 * handlers already parse; response schemas are authored from the Drizzle row
 * shapes (§17: `Date`/`date` columns serialize to strings over the wire).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * 5-verb CRUD bundle over six pricing resources (30 legs). The `createRoute`
 * objects co-locate with their handlers per the established admin route pattern
 * (mirrors `promotions/routes.ts`); splitting per resource would fragment the
 * single mounted instance without aiding review. See voyant#2114 / voyant#2208.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

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
import {
  cancellationChargeTypeSchema,
  cancellationPolicyTypeSchema,
  priceCatalogTypeSchema,
  pricingCategoryTypeSchema,
  pricingDependencyTypeSchema,
} from "./validation-shared.js"

const errorResponseSchema = z.object({ error: z.string() })
const deleteResponseSchema = z.object({ success: z.boolean() })
const idParamSchema = z.object({ id: z.string() })

/**
 * Insert helpers return `row ?? null`, but a successful `INSERT ... RETURNING`
 * always yields exactly one row. Narrow the type for the 201 response (a
 * missing row is an unexpected DB fault and surfaces as a 500).
 */
function created<T>(row: T | null): T {
  if (row === null) throw new Error("Insert returned no row")
  return row
}

const isoTimestamp = z.string()
const metadataSchema = z.record(z.string(), z.unknown()).nullable()

// --- Response row schemas (authored from the Drizzle $inferSelect shapes;
//     §17: timestamp/date columns are strings on the wire) ---------------

const pricingCategorySchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  unitId: z.string().nullable(),
  code: z.string().nullable(),
  name: z.string(),
  categoryType: pricingCategoryTypeSchema,
  seatOccupancy: z.number().int(),
  groupSize: z.number().int().nullable(),
  isAgeQualified: z.boolean(),
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  internalUseOnly: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const pricingCategoryDependencySchema = z.object({
  id: z.string(),
  pricingCategoryId: z.string(),
  masterPricingCategoryId: z.string(),
  dependencyType: pricingDependencyTypeSchema,
  maxPerMaster: z.number().int().nullable(),
  maxDependentSum: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const cancellationPolicySchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  policyType: cancellationPolicyTypeSchema,
  simpleCutoffHours: z.number().int().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const cancellationPolicyRuleSchema = z.object({
  id: z.string(),
  cancellationPolicyId: z.string(),
  sortOrder: z.number().int(),
  cutoffMinutesBefore: z.number().int().nullable(),
  chargeType: cancellationChargeTypeSchema,
  chargeAmountCents: z.number().int().nullable(),
  chargePercentBasisPoints: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const priceCatalogSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  currencyCode: z.string().nullable(),
  catalogType: priceCatalogTypeSchema,
  isDefault: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const priceScheduleSchema = z.object({
  id: z.string(),
  priceCatalogId: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  recurrenceRule: z.string(),
  timezone: z.string().nullable(),
  // `date` columns: strings over the wire (§17)
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  weekdays: z.array(z.string()).nullable(),
  priority: z.number().int(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- pricing-categories ---------------------------------------------------

const listPricingCategoriesRoute = createRoute({
  method: "get",
  path: "/pricing-categories",
  request: { query: pricingCategoryListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of pricing categories",
      content: { "application/json": { schema: listResponseSchema(pricingCategorySchema) } },
    },
  },
})

const createPricingCategoryRoute = createRoute({
  method: "post",
  path: "/pricing-categories",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPricingCategorySchema } },
    },
  },
  responses: {
    201: {
      description: "The created pricing category",
      content: { "application/json": { schema: z.object({ data: pricingCategorySchema }) } },
    },
  },
})

const getPricingCategoryRoute = createRoute({
  method: "get",
  path: "/pricing-categories/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A pricing category by id",
      content: { "application/json": { schema: z.object({ data: pricingCategorySchema }) } },
    },
    404: {
      description: "Pricing category not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePricingCategoryRoute = createRoute({
  method: "patch",
  path: "/pricing-categories/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePricingCategorySchema } },
    },
  },
  responses: {
    200: {
      description: "The updated pricing category",
      content: { "application/json": { schema: z.object({ data: pricingCategorySchema }) } },
    },
    404: {
      description: "Pricing category not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePricingCategoryRoute = createRoute({
  method: "delete",
  path: "/pricing-categories/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Pricing category deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Pricing category not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// --- pricing-category-dependencies ----------------------------------------

const listPricingCategoryDependenciesRoute = createRoute({
  method: "get",
  path: "/pricing-category-dependencies",
  request: { query: pricingCategoryDependencyListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of pricing category dependencies",
      content: {
        "application/json": { schema: listResponseSchema(pricingCategoryDependencySchema) },
      },
    },
  },
})

const createPricingCategoryDependencyRoute = createRoute({
  method: "post",
  path: "/pricing-category-dependencies",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPricingCategoryDependencySchema } },
    },
  },
  responses: {
    201: {
      description: "The created pricing category dependency",
      content: {
        "application/json": { schema: z.object({ data: pricingCategoryDependencySchema }) },
      },
    },
  },
})

const getPricingCategoryDependencyRoute = createRoute({
  method: "get",
  path: "/pricing-category-dependencies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A pricing category dependency by id",
      content: {
        "application/json": { schema: z.object({ data: pricingCategoryDependencySchema }) },
      },
    },
    404: {
      description: "Pricing category dependency not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePricingCategoryDependencyRoute = createRoute({
  method: "patch",
  path: "/pricing-category-dependencies/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePricingCategoryDependencySchema } },
    },
  },
  responses: {
    200: {
      description: "The updated pricing category dependency",
      content: {
        "application/json": { schema: z.object({ data: pricingCategoryDependencySchema }) },
      },
    },
    404: {
      description: "Pricing category dependency not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePricingCategoryDependencyRoute = createRoute({
  method: "delete",
  path: "/pricing-category-dependencies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Pricing category dependency deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Pricing category dependency not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// --- cancellation-policies ------------------------------------------------

const listCancellationPoliciesRoute = createRoute({
  method: "get",
  path: "/cancellation-policies",
  request: { query: cancellationPolicyListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of cancellation policies",
      content: { "application/json": { schema: listResponseSchema(cancellationPolicySchema) } },
    },
  },
})

const createCancellationPolicyRoute = createRoute({
  method: "post",
  path: "/cancellation-policies",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertCancellationPolicySchema } },
    },
  },
  responses: {
    201: {
      description: "The created cancellation policy",
      content: { "application/json": { schema: z.object({ data: cancellationPolicySchema }) } },
    },
  },
})

const getCancellationPolicyRoute = createRoute({
  method: "get",
  path: "/cancellation-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A cancellation policy by id",
      content: { "application/json": { schema: z.object({ data: cancellationPolicySchema }) } },
    },
    404: {
      description: "Cancellation policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateCancellationPolicyRoute = createRoute({
  method: "patch",
  path: "/cancellation-policies/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateCancellationPolicySchema } },
    },
  },
  responses: {
    200: {
      description: "The updated cancellation policy",
      content: { "application/json": { schema: z.object({ data: cancellationPolicySchema }) } },
    },
    404: {
      description: "Cancellation policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteCancellationPolicyRoute = createRoute({
  method: "delete",
  path: "/cancellation-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Cancellation policy deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Cancellation policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// --- cancellation-policy-rules --------------------------------------------

const listCancellationPolicyRulesRoute = createRoute({
  method: "get",
  path: "/cancellation-policy-rules",
  request: { query: cancellationPolicyRuleListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of cancellation policy rules",
      content: { "application/json": { schema: listResponseSchema(cancellationPolicyRuleSchema) } },
    },
  },
})

const createCancellationPolicyRuleRoute = createRoute({
  method: "post",
  path: "/cancellation-policy-rules",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertCancellationPolicyRuleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created cancellation policy rule",
      content: {
        "application/json": { schema: z.object({ data: cancellationPolicyRuleSchema }) },
      },
    },
  },
})

const getCancellationPolicyRuleRoute = createRoute({
  method: "get",
  path: "/cancellation-policy-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A cancellation policy rule by id",
      content: {
        "application/json": { schema: z.object({ data: cancellationPolicyRuleSchema }) },
      },
    },
    404: {
      description: "Cancellation policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateCancellationPolicyRuleRoute = createRoute({
  method: "patch",
  path: "/cancellation-policy-rules/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateCancellationPolicyRuleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated cancellation policy rule",
      content: {
        "application/json": { schema: z.object({ data: cancellationPolicyRuleSchema }) },
      },
    },
    404: {
      description: "Cancellation policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteCancellationPolicyRuleRoute = createRoute({
  method: "delete",
  path: "/cancellation-policy-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Cancellation policy rule deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Cancellation policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// --- price-catalogs -------------------------------------------------------

const listPriceCatalogsRoute = createRoute({
  method: "get",
  path: "/price-catalogs",
  request: { query: priceCatalogListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of price catalogs",
      content: { "application/json": { schema: listResponseSchema(priceCatalogSchema) } },
    },
  },
})

const createPriceCatalogRoute = createRoute({
  method: "post",
  path: "/price-catalogs",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPriceCatalogSchema } },
    },
  },
  responses: {
    201: {
      description: "The created price catalog",
      content: { "application/json": { schema: z.object({ data: priceCatalogSchema }) } },
    },
  },
})

const getPriceCatalogRoute = createRoute({
  method: "get",
  path: "/price-catalogs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A price catalog by id",
      content: { "application/json": { schema: z.object({ data: priceCatalogSchema }) } },
    },
    404: {
      description: "Price catalog not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePriceCatalogRoute = createRoute({
  method: "patch",
  path: "/price-catalogs/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePriceCatalogSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated price catalog",
      content: { "application/json": { schema: z.object({ data: priceCatalogSchema }) } },
    },
    404: {
      description: "Price catalog not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePriceCatalogRoute = createRoute({
  method: "delete",
  path: "/price-catalogs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Price catalog deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Price catalog not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// --- price-schedules ------------------------------------------------------

const listPriceSchedulesRoute = createRoute({
  method: "get",
  path: "/price-schedules",
  request: { query: priceScheduleListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of price schedules",
      content: { "application/json": { schema: listResponseSchema(priceScheduleSchema) } },
    },
  },
})

const createPriceScheduleRoute = createRoute({
  method: "post",
  path: "/price-schedules",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPriceScheduleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created price schedule",
      content: { "application/json": { schema: z.object({ data: priceScheduleSchema }) } },
    },
  },
})

const getPriceScheduleRoute = createRoute({
  method: "get",
  path: "/price-schedules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A price schedule by id",
      content: { "application/json": { schema: z.object({ data: priceScheduleSchema }) } },
    },
    404: {
      description: "Price schedule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePriceScheduleRoute = createRoute({
  method: "patch",
  path: "/price-schedules/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePriceScheduleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated price schedule",
      content: { "application/json": { schema: z.object({ data: priceScheduleSchema }) } },
    },
    404: {
      description: "Price schedule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePriceScheduleRoute = createRoute({
  method: "delete",
  path: "/price-schedules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Price schedule deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Price schedule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const pricingCoreRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  // pricing-categories
  .openapi(listPricingCategoriesRoute, async (c) =>
    c.json(await pricingService.listPricingCategories(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPricingCategoryRoute, async (c) =>
    c.json(
      {
        data: created(await pricingService.createPricingCategory(c.get("db"), c.req.valid("json"))),
      },
      201,
    ),
  )
  .openapi(getPricingCategoryRoute, async (c) => {
    const row = await pricingService.getPricingCategoryById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Pricing category not found")
  })
  .openapi(updatePricingCategoryRoute, async (c) => {
    const row = await pricingService.updatePricingCategory(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Pricing category not found")
  })
  .openapi(deletePricingCategoryRoute, async (c) => {
    const row = await pricingService.deletePricingCategory(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Pricing category not found")
  })
  // pricing-category-dependencies
  .openapi(listPricingCategoryDependenciesRoute, async (c) =>
    c.json(
      await pricingService.listPricingCategoryDependencies(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createPricingCategoryDependencyRoute, async (c) =>
    c.json(
      {
        data: created(
          await pricingService.createPricingCategoryDependency(c.get("db"), c.req.valid("json")),
        ),
      },
      201,
    ),
  )
  .openapi(getPricingCategoryDependencyRoute, async (c) => {
    const row = await pricingService.getPricingCategoryDependencyById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Pricing category dependency not found")
  })
  .openapi(updatePricingCategoryDependencyRoute, async (c) => {
    const row = await pricingService.updatePricingCategoryDependency(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Pricing category dependency not found")
  })
  .openapi(deletePricingCategoryDependencyRoute, async (c) => {
    const row = await pricingService.deletePricingCategoryDependency(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true }, 200)
      : notFound(c, "Pricing category dependency not found")
  })
  // cancellation-policies
  .openapi(listCancellationPoliciesRoute, async (c) =>
    c.json(await pricingService.listCancellationPolicies(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createCancellationPolicyRoute, async (c) =>
    c.json(
      {
        data: created(
          await pricingService.createCancellationPolicy(c.get("db"), c.req.valid("json")),
        ),
      },
      201,
    ),
  )
  .openapi(getCancellationPolicyRoute, async (c) => {
    const row = await pricingService.getCancellationPolicyById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Cancellation policy not found")
  })
  .openapi(updateCancellationPolicyRoute, async (c) => {
    const row = await pricingService.updateCancellationPolicy(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Cancellation policy not found")
  })
  .openapi(deleteCancellationPolicyRoute, async (c) => {
    const row = await pricingService.deleteCancellationPolicy(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Cancellation policy not found")
  })
  // cancellation-policy-rules
  .openapi(listCancellationPolicyRulesRoute, async (c) =>
    c.json(
      await pricingService.listCancellationPolicyRules(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createCancellationPolicyRuleRoute, async (c) =>
    c.json(
      {
        data: created(
          await pricingService.createCancellationPolicyRule(c.get("db"), c.req.valid("json")),
        ),
      },
      201,
    ),
  )
  .openapi(getCancellationPolicyRuleRoute, async (c) => {
    const row = await pricingService.getCancellationPolicyRuleById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Cancellation policy rule not found")
  })
  .openapi(updateCancellationPolicyRuleRoute, async (c) => {
    const row = await pricingService.updateCancellationPolicyRule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Cancellation policy rule not found")
  })
  .openapi(deleteCancellationPolicyRuleRoute, async (c) => {
    const row = await pricingService.deleteCancellationPolicyRule(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ success: true }, 200) : notFound(c, "Cancellation policy rule not found")
  })
  // price-catalogs
  .openapi(listPriceCatalogsRoute, async (c) =>
    c.json(await pricingService.listPriceCatalogs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPriceCatalogRoute, async (c) =>
    c.json(
      { data: created(await pricingService.createPriceCatalog(c.get("db"), c.req.valid("json"))) },
      201,
    ),
  )
  .openapi(getPriceCatalogRoute, async (c) => {
    const row = await pricingService.getPriceCatalogById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Price catalog not found")
  })
  .openapi(updatePriceCatalogRoute, async (c) => {
    const row = await pricingService.updatePriceCatalog(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Price catalog not found")
  })
  .openapi(deletePriceCatalogRoute, async (c) => {
    const row = await pricingService.deletePriceCatalog(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Price catalog not found")
  })
  // price-schedules
  .openapi(listPriceSchedulesRoute, async (c) =>
    c.json(await pricingService.listPriceSchedules(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPriceScheduleRoute, async (c) =>
    c.json(
      { data: created(await pricingService.createPriceSchedule(c.get("db"), c.req.valid("json"))) },
      201,
    ),
  )
  .openapi(getPriceScheduleRoute, async (c) => {
    const row = await pricingService.getPriceScheduleById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Price schedule not found")
  })
  .openapi(updatePriceScheduleRoute, async (c) => {
    const row = await pricingService.updatePriceSchedule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Price schedule not found")
  })
  .openapi(deletePriceScheduleRoute, async (c) => {
    const row = await pricingService.deletePriceSchedule(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Price schedule not found")
  })
