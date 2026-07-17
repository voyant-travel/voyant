import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { ApiHttpError, openApiValidationHook, stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"

import { createFinanceBookingTaxRuntime } from "./runtime.js"
import { financeOperatorSettingsRuntimePort } from "./runtime-port.js"
import { taxClasses, taxPolicyProfiles, taxPolicyRules, taxRegimes } from "./schema.js"
import { executeBoundaryRows } from "./service-boundary-sql.js"

export type ProductTaxFacts = {
  hasAccommodation: boolean
  accommodationCountries: string[]
}

export type ResolvedBookingSellTaxRate = {
  code: string
  label: string
  rate: number
  priceMode: "inclusive" | "exclusive"
}

export type InvoicingMode = "direct" | "proforma-first"

export type BookingTaxSettings = {
  taxPriceMode?: "inclusive" | "exclusive" | null
  taxPolicyProfileId?: string | null
  /**
   * Operator invoicing mode. `direct` bills the fiscal invoice
   * straight away; `proforma-first` issues a proforma and converts it
   * to a fiscal invoice on full settlement. Absent/null → `direct`.
   */
  invoicingMode?: InvoicingMode | null
}

type ResolvedBookingTaxSettings = {
  taxPriceMode: "inclusive" | "exclusive"
  taxPolicyProfileId: string | null
  invoicingMode: InvoicingMode
}

export type ResolveBookingTaxSettings = (
  db: PostgresJsDatabase,
) => BookingTaxSettings | null | undefined | Promise<BookingTaxSettings | null | undefined>

const taxPreviewBodySchema = z.object({
  productId: z.string().min(1),
  subtotalCents: z.number().int().min(0),
  currency: z.string().min(3).max(8),
})

const bookingTaxSettingsPatchSchema = z.object({
  taxPriceMode: z.enum(["inclusive", "exclusive"]).optional(),
  taxPolicyProfileId: z.string().min(1).nullable().optional(),
  invoicingMode: z.enum(["direct", "proforma-first"]).optional(),
})

const bookingTaxSettingsResponseSchema = z.object({
  data: z.object({
    taxPriceMode: z.enum(["inclusive", "exclusive"]),
    taxPolicyProfileId: z.string().nullable(),
    invoicingMode: z.enum(["direct", "proforma-first"]),
  }),
})

const bookingTaxPreviewResponseSchema = z.object({
  data: z.object({
    subtotalCents: z.number().int().nonnegative(),
    taxCents: z.number().int().nonnegative(),
    totalCents: z.number().int().nonnegative(),
    currency: z.string(),
    taxRate: z
      .object({
        code: z.string(),
        label: z.string(),
        rateBasisPoints: z.number().int(),
        priceMode: z.enum(["inclusive", "exclusive"]),
      })
      .nullable(),
  }),
})

const getBookingTaxSettingsRoute = createRoute({
  method: "get",
  path: "/tax-settings",
  responses: {
    200: {
      description: "The effective booking tax settings",
      content: { "application/json": { schema: bookingTaxSettingsResponseSchema } },
    },
  },
})

const updateBookingTaxSettingsRoute = createRoute({
  method: "patch",
  path: "/tax-settings",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: bookingTaxSettingsPatchSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated booking tax settings",
      content: { "application/json": { schema: bookingTaxSettingsResponseSchema } },
    },
    409: { description: "This deployment does not support tax setting updates" },
  },
})

const previewBookingTaxRoute = createRoute({
  method: "post",
  path: "/tax-preview",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: taxPreviewBodySchema } },
    },
  },
  responses: {
    200: {
      description: "The calculated tax preview",
      content: { "application/json": { schema: bookingTaxPreviewResponseSchema } },
    },
  },
})

export type UpdateBookingTaxSettings = (
  db: PostgresJsDatabase,
  settings: BookingTaxSettings,
) => BookingTaxSettings | null | undefined | Promise<BookingTaxSettings | null | undefined>

export type TaxPolicyCondition =
  | { always: true }
  | { all: TaxPolicyCondition[] }
  | { any: TaxPolicyCondition[] }
  | { fact: keyof ProductTaxFacts; eq?: unknown; contains?: unknown }

export interface ResolveBookingSellTaxRateOptions {
  settings?: BookingTaxSettings | null
  resolveBookingTaxSettings?: ResolveBookingTaxSettings
}

export interface BookingTaxRouteOptions extends ResolveBookingSellTaxRateOptions {
  updateBookingTaxSettings?: UpdateBookingTaxSettings
}

export async function resolveBookingSellTaxRate(
  db: PostgresJsDatabase,
  args: {
    productId?: string | null
    facts?: Partial<ProductTaxFacts>
  },
  options: ResolveBookingSellTaxRateOptions = {},
): Promise<ResolvedBookingSellTaxRate | null> {
  const resolvedSettings =
    options.settings !== undefined
      ? options.settings
      : ((await options.resolveBookingTaxSettings?.(db)) ?? null)
  const priceMode: "inclusive" | "exclusive" =
    resolvedSettings?.taxPriceMode === "exclusive" ? "exclusive" : "inclusive"
  const policyProfile = await resolveTaxPolicyProfile(db, resolvedSettings?.taxPolicyProfileId)

  if (policyProfile) {
    const facts = normalizeTaxFacts(
      args.facts ?? (args.productId ? await loadProductTaxFacts(db, args.productId) : undefined),
    )
    const rules = await db
      .select({
        condition: taxPolicyRules.condition,
        taxRegimeId: taxPolicyRules.taxRegimeId,
      })
      .from(taxPolicyRules)
      .where(
        and(
          eq(taxPolicyRules.profileId, policyProfile.id),
          eq(taxPolicyRules.side, "sell"),
          eq(taxPolicyRules.active, true),
        ),
      )
      .orderBy(asc(taxPolicyRules.priority), asc(taxPolicyRules.createdAt))

    for (const rule of rules) {
      if (!matchesTaxPolicyCondition(rule.condition as TaxPolicyCondition | null, facts)) continue
      const resolved = await loadResolvedTaxRegime(db, rule.taxRegimeId, policyProfile.code)
      if (resolved) return { ...resolved, priceMode }
    }
  }

  return args.productId ? resolveProductTaxClassRate(db, args.productId, priceMode) : null
}

async function resolveBookingTaxSettingsOrDefault(
  db: PostgresJsDatabase,
  options: ResolveBookingSellTaxRateOptions = {},
): Promise<ResolvedBookingTaxSettings> {
  const settings =
    options.settings !== undefined
      ? options.settings
      : ((await options.resolveBookingTaxSettings?.(db)) ?? null)

  return {
    taxPriceMode: settings?.taxPriceMode === "exclusive" ? "exclusive" : "inclusive",
    taxPolicyProfileId: settings?.taxPolicyProfileId ?? null,
    invoicingMode: settings?.invoicingMode === "proforma-first" ? "proforma-first" : "direct",
  }
}

/**
 * Resolve just the operator invoicing mode, defaulting to `direct`
 * when no settings row exists. Shared by the proforma-conversion
 * subscriber so it never converts unless the operator opted in.
 */
export async function resolveInvoicingModeOrDefault(
  db: PostgresJsDatabase,
  options: ResolveBookingSellTaxRateOptions = {},
): Promise<InvoicingMode> {
  const settings = await resolveBookingTaxSettingsOrDefault(db, options)
  return settings.invoicingMode
}

export function computeBookingItemTaxLine(
  taxRate: ResolvedBookingSellTaxRate | null,
  amountCents: number,
  currency: string,
  sortOrder = 0,
) {
  if (!taxRate || taxRate.rate <= 0 || amountCents <= 0) return null
  const includedInPrice = taxRate.priceMode === "inclusive"
  const taxCents = includedInPrice
    ? Math.round(amountCents - amountCents / (1 + taxRate.rate))
    : Math.round(amountCents * taxRate.rate)
  if (taxCents <= 0) return null

  return {
    code: taxRate.code,
    name: taxRate.label,
    scope: includedInPrice ? ("included" as const) : ("excluded" as const),
    currency,
    amountCents: taxCents,
    rateBasisPoints: Math.round(taxRate.rate * 10_000),
    includedInPrice,
    sortOrder,
  }
}

export async function loadProductTaxFacts(
  db: PostgresJsDatabase,
  productId: string,
): Promise<ProductTaxFacts> {
  const [accommodationLocations, accommodationServices] = await Promise.all([
    executeBoundaryRows<{ country_code: string | null }>(
      db,
      // agent-quality: raw-sql reviewed -- owner: finance; Product owns product_locations and product ids are parameter-bound through Drizzle.
      sql`
        SELECT country_code
        FROM product_locations
        WHERE product_id = ${productId}
      `,
    ),
    executeBoundaryRows<{ id: string; country_code: string | null }>(
      db,
      // agent-quality: raw-sql reviewed -- owner: finance; Product itinerary tables are read-only tax fact inputs with parameter-bound product id.
      sql`
        SELECT pds.id, pds.country_code
        FROM product_day_services pds
        INNER JOIN product_days pd ON pds.day_id = pd.id
        INNER JOIN product_itineraries pi ON pd.itinerary_id = pi.id
        WHERE pi.product_id = ${productId}
          AND pds.service_type::text = 'accommodation'
      `,
    ),
  ])
  const accommodationCountries = [...accommodationServices, ...accommodationLocations]
    .map((entry) => entry.country_code?.trim().toUpperCase())
    .filter((countryCode): countryCode is string => Boolean(countryCode))

  return {
    hasAccommodation: accommodationLocations.length > 0 || accommodationServices.length > 0,
    accommodationCountries: [...new Set(accommodationCountries)],
  }
}

export function matchesTaxPolicyCondition(
  condition: TaxPolicyCondition | null | undefined,
  facts: ProductTaxFacts,
): boolean {
  if (!condition) return true
  if ("always" in condition) return condition.always === true
  if ("all" in condition)
    return condition.all.every((entry) => matchesTaxPolicyCondition(entry, facts))
  if ("any" in condition)
    return condition.any.some((entry) => matchesTaxPolicyCondition(entry, facts))
  if (!("fact" in condition)) return false

  const value = facts[condition.fact]
  if ("eq" in condition) return value === condition.eq
  if ("contains" in condition) {
    return Array.isArray(value) && value.includes(String(condition.contains).toUpperCase())
  }
  return false
}

function normalizeTaxFacts(facts?: Partial<ProductTaxFacts>): ProductTaxFacts {
  return {
    hasAccommodation: facts?.hasAccommodation === true,
    accommodationCountries: [
      ...new Set(
        (facts?.accommodationCountries ?? [])
          .map((countryCode) => countryCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    ],
  }
}

async function resolveTaxPolicyProfile(
  db: PostgresJsDatabase,
  configuredProfileId?: string | null,
) {
  if (configuredProfileId) {
    const [configured] = await db
      .select()
      .from(taxPolicyProfiles)
      .where(eq(taxPolicyProfiles.id, configuredProfileId))
      .limit(1)
    if (configured?.active) return configured
  }

  const [active] = await db
    .select()
    .from(taxPolicyProfiles)
    .where(eq(taxPolicyProfiles.active, true))
    .orderBy(asc(taxPolicyProfiles.createdAt))
    .limit(1)
  return active ?? null
}

async function loadResolvedTaxRegime(
  db: PostgresJsDatabase,
  taxRegimeId: string,
  codePrefix: string,
) {
  const [regime] = await db
    .select({
      ratePercent: taxRegimes.ratePercent,
      code: taxRegimes.code,
      name: taxRegimes.name,
    })
    .from(taxRegimes)
    .where(eq(taxRegimes.id, taxRegimeId))
    .limit(1)
  if (!regime || regime.ratePercent == null) return null

  return {
    code: `${codePrefix}/${regime.code}`,
    label: regime.name,
    rate: regime.ratePercent / 100,
  }
}

async function resolveProductTaxClassRate(
  db: PostgresJsDatabase,
  productId: string,
  priceMode: "inclusive" | "exclusive",
) {
  const productRows = await executeBoundaryRows<{ tax_class_id: string | null }>(
    db,
    // agent-quality: raw-sql reviewed -- owner: finance; Product owns product tax-class assignment and product id is parameter-bound.
    sql`
      SELECT tax_class_id
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `,
  )
  const taxClassId = productRows[0]?.tax_class_id
  if (!taxClassId) return null

  const classRows = await db
    .select({
      defaultRegimeId: taxClasses.defaultRegimeId,
      code: taxClasses.code,
    })
    .from(taxClasses)
    .where(eq(taxClasses.id, taxClassId))
    .limit(1)
  const klass = classRows[0]
  if (!klass?.defaultRegimeId) return null

  const resolved = await loadResolvedTaxRegime(db, klass.defaultRegimeId, klass.code)
  return resolved ? { ...resolved, priceMode } : null
}

export function createBookingTaxRoutes(options: BookingTaxRouteOptions = {}) {
  const routes = new OpenAPIHono<{
    Variables: {
      db: PostgresJsDatabase
    }
  }>({ defaultHook: openApiValidationHook })
    .openapi(getBookingTaxSettingsRoute, async (c) => {
      return c.json(
        {
          data: await resolveBookingTaxSettingsOrDefault(c.get("db"), options),
        },
        200,
      )
    })
    .openapi(updateBookingTaxSettingsRoute, async (c) => {
      if (!options.updateBookingTaxSettings) {
        throw new ApiHttpError("Booking tax settings updates are not configured", {
          status: 409,
          code: "booking_tax_settings_update_not_configured",
        })
      }

      const current = await resolveBookingTaxSettingsOrDefault(c.get("db"), options)
      const patch = c.req.valid("json")
      const next = await options.updateBookingTaxSettings(c.get("db"), {
        taxPriceMode: patch.taxPriceMode ?? current.taxPriceMode,
        taxPolicyProfileId:
          patch.taxPolicyProfileId === undefined
            ? current.taxPolicyProfileId
            : patch.taxPolicyProfileId,
        invoicingMode: patch.invoicingMode ?? current.invoicingMode,
      })

      return c.json(
        {
          data: await resolveBookingTaxSettingsOrDefault(c.get("db"), { settings: next }),
        },
        200,
      )
    })
    .openapi(previewBookingTaxRoute, async (c) => {
      const body = c.req.valid("json")
      const taxRate = await resolveBookingSellTaxRate(
        c.get("db"),
        { productId: body.productId },
        options,
      )
      const taxLine = computeBookingItemTaxLine(taxRate, body.subtotalCents, body.currency)

      if (!taxRate || !taxLine) {
        return c.json(
          {
            data: {
              subtotalCents: body.subtotalCents,
              taxCents: 0,
              totalCents: body.subtotalCents,
              currency: body.currency,
              taxRate: null,
            },
          },
          200,
        )
      }

      const inclusive = taxLine.includedInPrice
      const displaySubtotal = inclusive
        ? Math.max(0, body.subtotalCents - taxLine.amountCents)
        : body.subtotalCents
      const total = inclusive ? body.subtotalCents : body.subtotalCents + taxLine.amountCents

      return c.json(
        {
          data: {
            subtotalCents: displaySubtotal,
            taxCents: taxLine.amountCents,
            totalCents: total,
            currency: body.currency,
            taxRate: {
              code: taxRate.code,
              label: taxRate.label,
              rateBasisPoints: Math.round(taxRate.rate * 10_000),
              priceMode: taxRate.priceMode,
            },
          },
        },
        200,
      )
    })

  return stampOpenApiRegistryApiId(routes, "@voyant-travel/finance#booking-tax-extension.api")
}

export function mountBookingTaxRoutes(hono: Hono, options: BookingTaxRouteOptions = {}): void {
  hono.route("/v1/admin/bookings", createBookingTaxRoutes(options))
}

export function createBookingTaxApiExtension(options: BookingTaxRouteOptions = {}): ApiExtension {
  const extension: Extension = {
    name: "booking-tax",
    module: "bookings",
  }

  return {
    extension,
    adminRoutes: createBookingTaxRoutes(options),
  }
}

export const createBookingTaxVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) => {
  return createBookingTaxApiExtension(
    createFinanceBookingTaxRuntime(await getPort(financeOperatorSettingsRuntimePort)),
  )
})
