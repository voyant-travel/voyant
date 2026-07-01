/**
 * Admin CRUD routes for finance reference-data resources — mounted by the
 * operator starter under `/v1/admin/finance/...` (staff-actor-gated by the
 * parent app's middleware chain). Covers six resources: invoice-number-series,
 * invoice-templates, tax-regimes, tax-classes, tax-policy-profiles,
 * tax-policy-rules.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9A). Request schemas reuse the existing
 * `validation.ts` (`@voyant-travel/finance-contracts`) schemas the handlers
 * already parse; response row schemas are authored from the Drizzle
 * `$inferSelect` shapes (§17: `Date`/timestamp columns serialize to strings
 * over the wire; integer money/rate fields stay numbers). Each resource is its
 * own small `OpenAPIHono` sub-chain composed onto `financeReferenceDataRoutes`
 * via `.route("/")` — six small chains keep type-inference cost bounded (one
 * flat 31-leg chain has O(n²) inference cost and OOMs the framework build).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD bundle over six finance reference-data resources (31 legs), each with a
 * `createRoute` def + handler co-located per the established admin route
 * pattern (mirrors the sibling pricing `routes-rules.ts`). Splitting per
 * resource would fragment the single mounted instance without aiding review.
 * See voyant#2114 / voyant#2208.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { type Env, notFound } from "./routes-shared.js"
import { financeService } from "./service.js"
import { ReferenceDataValidationError } from "./service-reference-data.js"
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

const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})
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
const metadataSchema = z.unknown().nullable()

// --- Response row schemas (authored from the Drizzle $inferSelect shapes;
//     §17: timestamp columns are strings on the wire; integer money/rate
//     columns stay numbers) ------------------------------------------------

const invoiceNumberSeriesSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  prefix: z.string(),
  separator: z.string(),
  padLength: z.number().int(),
  currentSequence: z.number().int(),
  resetStrategy: z.enum(["never", "annual", "monthly"]),
  resetAt: isoTimestamp.nullable(),
  scope: z.enum(["invoice", "proforma", "credit_note"]),
  isDefault: z.boolean(),
  externalProvider: z.string().nullable(),
  externalConfigKey: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const invoiceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  language: z.string(),
  jurisdiction: z.string().nullable(),
  bodyFormat: z.enum(["html", "markdown", "lexical_json"]),
  body: z.string(),
  cssStyles: z.string().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const taxRegimeSchema = z.object({
  id: z.string(),
  code: z.enum([
    "standard",
    "reduced",
    "exempt",
    "reverse_charge",
    "margin_scheme_art311",
    "zero_rated",
    "out_of_scope",
    "other",
  ]),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  ratePercent: z.number().int().nullable(),
  description: z.string().nullable(),
  legalReference: z.string().nullable(),
  active: z.boolean(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const taxClassLineSchema = z.object({
  regime_id: z.string(),
  applies_to: z.enum(["base", "addon", "accommodation", "all"]),
})

const taxClassSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  defaultRegimeId: z.string().nullable(),
  lines: z.array(taxClassLineSchema).nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const taxPolicyProfileSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  description: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const taxPolicyRuleSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  side: z.enum(["sell", "buy"]),
  priority: z.number().int(),
  name: z.string(),
  appliesTo: z.enum(["base", "addon", "accommodation", "all"]),
  condition: z.record(z.string(), z.unknown()).nullable(),
  taxRegimeId: z.string(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const allocateInvoiceNumberResultSchema = z.object({
  data: z.object({
    sequence: z.number().int(),
    formattedNumber: z.string(),
  }),
})

// --- invoice-number-series ------------------------------------------------

const listInvoiceNumberSeriesRoute = createRoute({
  method: "get",
  path: "/invoice-number-series",
  request: { query: invoiceNumberSeriesListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of invoice number series",
      content: { "application/json": { schema: listResponseSchema(invoiceNumberSeriesSchema) } },
    },
  },
})

const createInvoiceNumberSeriesRoute = createRoute({
  method: "post",
  path: "/invoice-number-series",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertInvoiceNumberSeriesSchema } },
    },
  },
  responses: {
    201: {
      description: "The created invoice number series",
      content: { "application/json": { schema: z.object({ data: invoiceNumberSeriesSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getInvoiceNumberSeriesRoute = createRoute({
  method: "get",
  path: "/invoice-number-series/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An invoice number series by id",
      content: { "application/json": { schema: z.object({ data: invoiceNumberSeriesSchema }) } },
    },
    404: {
      description: "Invoice number series not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateInvoiceNumberSeriesRoute = createRoute({
  method: "patch",
  path: "/invoice-number-series/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateInvoiceNumberSeriesSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated invoice number series",
      content: { "application/json": { schema: z.object({ data: invoiceNumberSeriesSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Invoice number series not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteInvoiceNumberSeriesRoute = createRoute({
  method: "delete",
  path: "/invoice-number-series/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Invoice number series deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Invoice number series not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const allocateInvoiceNumberRoute = createRoute({
  method: "post",
  path: "/invoice-number-series/{id}/allocate",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The allocated sequence + formatted number",
      content: { "application/json": { schema: allocateInvoiceNumberResultSchema } },
    },
    404: {
      description: "Invoice number series not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Invoice number series is inactive",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const invoiceNumberSeriesRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listInvoiceNumberSeriesRoute, async (c) =>
    c.json(await financeService.listInvoiceNumberSeries(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createInvoiceNumberSeriesRoute, async (c) =>
    c.json(
      {
        data: created(
          await financeService.createInvoiceNumberSeries(c.get("db"), c.req.valid("json")),
        ),
      },
      201,
    ),
  )
  .openapi(getInvoiceNumberSeriesRoute, async (c) => {
    const row = await financeService.getInvoiceNumberSeriesById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Invoice number series not found")
  })
  .openapi(updateInvoiceNumberSeriesRoute, async (c) => {
    const row = await financeService.updateInvoiceNumberSeries(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Invoice number series not found")
  })
  .openapi(deleteInvoiceNumberSeriesRoute, async (c) => {
    const row = await financeService.deleteInvoiceNumberSeries(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Invoice number series not found")
  })
  .openapi(allocateInvoiceNumberRoute, async (c) => {
    const result = await financeService.allocateInvoiceNumber(c.get("db"), c.req.valid("param").id)
    if (result.status === "not_found") {
      return notFound(c, "Invoice number series not found")
    }
    if (result.status === "inactive") {
      return c.json({ error: "Invoice number series is inactive" }, 409)
    }
    return c.json(
      { data: { sequence: result.sequence, formattedNumber: result.formattedNumber } },
      200,
    )
  })

// --- invoice-templates ----------------------------------------------------

const listInvoiceTemplatesRoute = createRoute({
  method: "get",
  path: "/invoice-templates",
  request: { query: invoiceTemplateListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of invoice templates",
      content: { "application/json": { schema: listResponseSchema(invoiceTemplateSchema) } },
    },
  },
})

const createInvoiceTemplateRoute = createRoute({
  method: "post",
  path: "/invoice-templates",
  request: {
    body: {
      required: true,
      description: "Invoice template. `slug` must be kebab-case (`^[a-z0-9-]+$`).",
      content: { "application/json": { schema: insertInvoiceTemplateSchema } },
    },
  },
  responses: {
    201: {
      description: "The created invoice template",
      content: { "application/json": { schema: z.object({ data: invoiceTemplateSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getInvoiceTemplateRoute = createRoute({
  method: "get",
  path: "/invoice-templates/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An invoice template by id",
      content: { "application/json": { schema: z.object({ data: invoiceTemplateSchema }) } },
    },
    404: {
      description: "Invoice template not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateInvoiceTemplateRoute = createRoute({
  method: "patch",
  path: "/invoice-templates/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description: "Invoice template patch. `slug` must be kebab-case (`^[a-z0-9-]+$`).",
      content: { "application/json": { schema: updateInvoiceTemplateSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated invoice template",
      content: { "application/json": { schema: z.object({ data: invoiceTemplateSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Invoice template not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteInvoiceTemplateRoute = createRoute({
  method: "delete",
  path: "/invoice-templates/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Invoice template deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Invoice template not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const invoiceTemplateRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listInvoiceTemplatesRoute, async (c) =>
    c.json(await financeService.listInvoiceTemplates(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createInvoiceTemplateRoute, async (c) =>
    c.json(
      {
        data: created(await financeService.createInvoiceTemplate(c.get("db"), c.req.valid("json"))),
      },
      201,
    ),
  )
  .openapi(getInvoiceTemplateRoute, async (c) => {
    const row = await financeService.getInvoiceTemplateById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Invoice template not found")
  })
  .openapi(updateInvoiceTemplateRoute, async (c) => {
    const row = await financeService.updateInvoiceTemplate(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Invoice template not found")
  })
  .openapi(deleteInvoiceTemplateRoute, async (c) => {
    const row = await financeService.deleteInvoiceTemplate(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Invoice template not found")
  })

// --- tax-regimes ----------------------------------------------------------

const listTaxRegimesRoute = createRoute({
  method: "get",
  path: "/tax-regimes",
  request: { query: taxRegimeListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of tax regimes",
      content: { "application/json": { schema: listResponseSchema(taxRegimeSchema) } },
    },
  },
})

const createTaxRegimeRoute = createRoute({
  method: "post",
  path: "/tax-regimes",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertTaxRegimeSchema } },
    },
  },
  responses: {
    201: {
      description: "The created tax regime",
      content: { "application/json": { schema: z.object({ data: taxRegimeSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getTaxRegimeRoute = createRoute({
  method: "get",
  path: "/tax-regimes/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A tax regime by id",
      content: { "application/json": { schema: z.object({ data: taxRegimeSchema }) } },
    },
    404: {
      description: "Tax regime not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTaxRegimeRoute = createRoute({
  method: "patch",
  path: "/tax-regimes/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTaxRegimeSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated tax regime",
      content: { "application/json": { schema: z.object({ data: taxRegimeSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Tax regime not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteTaxRegimeRoute = createRoute({
  method: "delete",
  path: "/tax-regimes/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tax regime deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Tax regime not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const taxRegimeRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTaxRegimesRoute, async (c) =>
    c.json(await financeService.listTaxRegimes(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTaxRegimeRoute, async (c) =>
    c.json(
      { data: created(await financeService.createTaxRegime(c.get("db"), c.req.valid("json"))) },
      201,
    ),
  )
  .openapi(getTaxRegimeRoute, async (c) => {
    const row = await financeService.getTaxRegimeById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax regime not found")
  })
  .openapi(updateTaxRegimeRoute, async (c) => {
    const row = await financeService.updateTaxRegime(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax regime not found")
  })
  .openapi(deleteTaxRegimeRoute, async (c) => {
    const row = await financeService.deleteTaxRegime(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Tax regime not found")
  })

// --- tax-classes ----------------------------------------------------------

const listTaxClassesRoute = createRoute({
  method: "get",
  path: "/tax-classes",
  request: { query: taxClassListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of tax classes",
      content: { "application/json": { schema: listResponseSchema(taxClassSchema) } },
    },
  },
})

const createTaxClassRoute = createRoute({
  method: "post",
  path: "/tax-classes",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertTaxClassSchema } },
    },
  },
  responses: {
    201: {
      description: "The created tax class",
      content: { "application/json": { schema: z.object({ data: taxClassSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getTaxClassRoute = createRoute({
  method: "get",
  path: "/tax-classes/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A tax class by id",
      content: { "application/json": { schema: z.object({ data: taxClassSchema }) } },
    },
    404: {
      description: "Tax class not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTaxClassRoute = createRoute({
  method: "patch",
  path: "/tax-classes/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTaxClassSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated tax class",
      content: { "application/json": { schema: z.object({ data: taxClassSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Tax class not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteTaxClassRoute = createRoute({
  method: "delete",
  path: "/tax-classes/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tax class deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Tax class not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const taxClassRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTaxClassesRoute, async (c) =>
    c.json(await financeService.listTaxClasses(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTaxClassRoute, async (c) => {
    try {
      return c.json(
        { data: created(await financeService.createTaxClass(c.get("db"), c.req.valid("json"))) },
        201,
      )
    } catch (error) {
      if (error instanceof ReferenceDataValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }
      throw error
    }
  })
  .openapi(getTaxClassRoute, async (c) => {
    const row = await financeService.getTaxClassById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax class not found")
  })
  .openapi(updateTaxClassRoute, async (c) => {
    try {
      const row = await financeService.updateTaxClass(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row ? c.json({ data: row }, 200) : notFound(c, "Tax class not found")
    } catch (error) {
      if (error instanceof ReferenceDataValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }
      throw error
    }
  })
  .openapi(deleteTaxClassRoute, async (c) => {
    const row = await financeService.deleteTaxClass(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Tax class not found")
  })

// --- tax-policy-profiles --------------------------------------------------

const listTaxPolicyProfilesRoute = createRoute({
  method: "get",
  path: "/tax-policy-profiles",
  request: { query: taxPolicyProfileListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of tax policy profiles",
      content: { "application/json": { schema: listResponseSchema(taxPolicyProfileSchema) } },
    },
  },
})

const createTaxPolicyProfileRoute = createRoute({
  method: "post",
  path: "/tax-policy-profiles",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertTaxPolicyProfileSchema } },
    },
  },
  responses: {
    201: {
      description: "The created tax policy profile",
      content: { "application/json": { schema: z.object({ data: taxPolicyProfileSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getTaxPolicyProfileRoute = createRoute({
  method: "get",
  path: "/tax-policy-profiles/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A tax policy profile by id",
      content: { "application/json": { schema: z.object({ data: taxPolicyProfileSchema }) } },
    },
    404: {
      description: "Tax policy profile not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTaxPolicyProfileRoute = createRoute({
  method: "patch",
  path: "/tax-policy-profiles/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTaxPolicyProfileSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated tax policy profile",
      content: { "application/json": { schema: z.object({ data: taxPolicyProfileSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Tax policy profile not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteTaxPolicyProfileRoute = createRoute({
  method: "delete",
  path: "/tax-policy-profiles/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tax policy profile deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Tax policy profile not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const taxPolicyProfileRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTaxPolicyProfilesRoute, async (c) =>
    c.json(await financeService.listTaxPolicyProfiles(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTaxPolicyProfileRoute, async (c) =>
    c.json(
      {
        data: created(
          await financeService.createTaxPolicyProfile(c.get("db"), c.req.valid("json")),
        ),
      },
      201,
    ),
  )
  .openapi(getTaxPolicyProfileRoute, async (c) => {
    const row = await financeService.getTaxPolicyProfileById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax policy profile not found")
  })
  .openapi(updateTaxPolicyProfileRoute, async (c) => {
    const row = await financeService.updateTaxPolicyProfile(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax policy profile not found")
  })
  .openapi(deleteTaxPolicyProfileRoute, async (c) => {
    const row = await financeService.deleteTaxPolicyProfile(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Tax policy profile not found")
  })

// --- tax-policy-rules -----------------------------------------------------

const listTaxPolicyRulesRoute = createRoute({
  method: "get",
  path: "/tax-policy-rules",
  request: { query: taxPolicyRuleListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of tax policy rules",
      content: { "application/json": { schema: listResponseSchema(taxPolicyRuleSchema) } },
    },
  },
})

const createTaxPolicyRuleRoute = createRoute({
  method: "post",
  path: "/tax-policy-rules",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertTaxPolicyRuleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created tax policy rule",
      content: { "application/json": { schema: z.object({ data: taxPolicyRuleSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getTaxPolicyRuleRoute = createRoute({
  method: "get",
  path: "/tax-policy-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A tax policy rule by id",
      content: { "application/json": { schema: z.object({ data: taxPolicyRuleSchema }) } },
    },
    404: {
      description: "Tax policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTaxPolicyRuleRoute = createRoute({
  method: "patch",
  path: "/tax-policy-rules/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTaxPolicyRuleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated tax policy rule",
      content: { "application/json": { schema: z.object({ data: taxPolicyRuleSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Tax policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteTaxPolicyRuleRoute = createRoute({
  method: "delete",
  path: "/tax-policy-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tax policy rule deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Tax policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const taxPolicyRuleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTaxPolicyRulesRoute, async (c) =>
    c.json(await financeService.listTaxPolicyRules(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTaxPolicyRuleRoute, async (c) => {
    try {
      return c.json(
        {
          data: created(await financeService.createTaxPolicyRule(c.get("db"), c.req.valid("json"))),
        },
        201,
      )
    } catch (error) {
      if (error instanceof ReferenceDataValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }
      throw error
    }
  })
  .openapi(getTaxPolicyRuleRoute, async (c) => {
    const row = await financeService.getTaxPolicyRuleById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : notFound(c, "Tax policy rule not found")
  })
  .openapi(updateTaxPolicyRuleRoute, async (c) => {
    try {
      const row = await financeService.updateTaxPolicyRule(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row ? c.json({ data: row }, 200) : notFound(c, "Tax policy rule not found")
    } catch (error) {
      if (error instanceof ReferenceDataValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }
      throw error
    }
  })
  .openapi(deleteTaxPolicyRuleRoute, async (c) => {
    const row = await financeService.deleteTaxPolicyRule(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ success: true }, 200) : notFound(c, "Tax policy rule not found")
  })

// Compose the six per-resource sub-chains onto a single OpenAPIHono so the
// `.openapi()` operations propagate up through the parent `financeRoutes`
// registry (OpenAPIHono.route copies the sub-app's registered routes).
export const financeReferenceDataRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", invoiceNumberSeriesRoutes)
  .route("/", invoiceTemplateRoutes)
  .route("/", taxRegimeRoutes)
  .route("/", taxClassRoutes)
  .route("/", taxPolicyProfileRoutes)
  .route("/", taxPolicyRuleRoutes)
