import { taxClasses, taxPolicyProfiles, taxPolicyRules, taxRegimes } from "@voyantjs/finance"
import {
  productDayServices,
  productDays,
  productItineraries,
  productLocations,
  products as productsTable,
} from "@voyantjs/products/schema"
import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { getOperatorSettings } from "../settings"

export type ProductTaxFacts = {
  hasAccommodation: boolean
  accommodationCountries: string[]
}

export type ResolvedOperatorTaxRate = {
  code: string
  label: string
  rate: number
  priceMode: "inclusive" | "exclusive"
}

type TaxPolicyCondition =
  | { always: true }
  | { all: TaxPolicyCondition[] }
  | { any: TaxPolicyCondition[] }
  | { fact: keyof ProductTaxFacts; eq?: unknown; contains?: unknown }

export async function resolveOperatorSellTaxRate(
  db: PostgresJsDatabase,
  args: {
    productId?: string | null
    facts?: Partial<ProductTaxFacts>
  },
): Promise<ResolvedOperatorTaxRate | null> {
  const operatorSettings = await getOperatorSettings(db)
  const priceMode: "inclusive" | "exclusive" =
    operatorSettings?.taxPriceMode === "exclusive" ? "exclusive" : "inclusive"
  const policyProfile = await resolveTaxPolicyProfile(db, operatorSettings?.taxPolicyProfileId)

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

export function computeBookingItemTaxLine(
  taxRate: ResolvedOperatorTaxRate | null,
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

async function loadProductTaxFacts(
  db: PostgresJsDatabase,
  productId: string,
): Promise<ProductTaxFacts> {
  const [accommodationLocations, accommodationServices] = await Promise.all([
    db
      .select({ countryCode: productLocations.countryCode })
      .from(productLocations)
      .where(eq(productLocations.productId, productId)),
    db
      .select({ id: productDayServices.id, countryCode: productDayServices.countryCode })
      .from(productDayServices)
      .innerJoin(productDays, eq(productDayServices.dayId, productDays.id))
      .innerJoin(productItineraries, eq(productDays.itineraryId, productItineraries.id))
      .where(
        and(
          eq(productItineraries.productId, productId),
          eq(productDayServices.serviceType, "accommodation"),
        ),
      ),
  ])
  const accommodationCountries = [...accommodationServices, ...accommodationLocations]
    .map((entry) => entry.countryCode?.trim().toUpperCase())
    .filter((countryCode): countryCode is string => Boolean(countryCode))

  return {
    hasAccommodation: accommodationLocations.length > 0 || accommodationServices.length > 0,
    accommodationCountries: [...new Set(accommodationCountries)],
  }
}

function matchesTaxPolicyCondition(
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
  const productRows = await db
    .select({ taxClassId: productsTable.taxClassId })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1)
  const taxClassId = productRows[0]?.taxClassId
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
