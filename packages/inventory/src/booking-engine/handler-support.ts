import type {
  AddonOffer,
  CommitOwnedRequest,
  OwnedHandlerContext,
  ProductVariantOption,
} from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { products } from "../schema-core.js"
import type {
  BookingCreateBridgeInput,
  CreateProductsBookingHandlerOptions,
  DraftLike,
  ResolvedOptionPrice,
} from "./handler.js"

export async function loadProduct(
  db: AnyDrizzleDb,
  productId: string,
): Promise<typeof products.$inferSelect | undefined> {
  const drizzle = db as PostgresJsDatabase
  const rows = (await drizzle
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)) as Array<typeof products.$inferSelect>
  return rows[0]
}

export function sumPax(pax: Partial<Record<string, number>> | undefined): number {
  if (!pax) return 0
  let total = 0
  for (const v of Object.values(pax)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) total += v
  }
  return total
}

export interface PricedLine {
  kind: "base" | "addon"
  label: string
  quantity: number
  unitAmount: number
  totalAmount: number
}

export interface PricedQuote {
  totalCents: number
  lines: PricedLine[]
}

export interface NormalizedOptionSelection {
  optionId: string
  optionUnitId?: string
  optionName?: string
  optionUnitName?: string
  quantity: number
}

type DraftOptionSelection = NonNullable<
  NonNullable<DraftLike["configure"]>["optionSelections"]
>[number]

export function normalizeOptionSelections(
  selections: ReadonlyArray<DraftOptionSelection> | undefined,
): NormalizedOptionSelection[] {
  if (!Array.isArray(selections)) return []
  return selections.flatMap((selection) => {
    if (
      !selection ||
      typeof selection !== "object" ||
      typeof selection.optionId !== "string" ||
      selection.optionId.length === 0
    ) {
      return []
    }
    const quantity =
      typeof selection.quantity === "number" && Number.isFinite(selection.quantity)
        ? Math.floor(selection.quantity)
        : 0
    if (quantity <= 0) return []
    return [
      {
        optionId: selection.optionId,
        ...(typeof selection.optionUnitId === "string" && selection.optionUnitId.length > 0
          ? { optionUnitId: selection.optionUnitId }
          : {}),
        ...(typeof selection.optionName === "string" ? { optionName: selection.optionName } : {}),
        ...(typeof selection.optionUnitName === "string"
          ? { optionUnitName: selection.optionUnitName }
          : {}),
        quantity,
      },
    ]
  })
}

export async function priceOptionSelections(input: {
  ctx: OwnedHandlerContext
  options: CreateProductsBookingHandlerOptions
  product: typeof products.$inferSelect
  productOptions: ReadonlyArray<ProductVariantOption>
  selections: ReadonlyArray<NormalizedOptionSelection>
  slotDate: string | null
}): Promise<PricedQuote> {
  const lines: PricedLine[] = []
  let totalCents = 0
  const optionsById = new Map(input.productOptions.map((option) => [option.id, option]))

  for (const selection of input.selections) {
    const resolvedPrice =
      input.slotDate && input.options.loadResolvedOptionPrice
        ? await input.options.loadResolvedOptionPrice(input.ctx, {
            productId: input.product.id,
            optionId: selection.optionId,
            date: input.slotDate,
          })
        : null
    const unitPrice =
      selection.optionUnitId && resolvedPrice?.unitPrices
        ? resolvedPrice.unitPrices.find((unit) => unit.unitId === selection.optionUnitId)
            ?.sellAmountCents
        : null
    const unitAmount =
      unitPrice ?? resolvedPrice?.baseSellAmountCents ?? input.product.sellAmountCents ?? 0
    if (unitAmount <= 0) continue
    const totalAmount = unitAmount * selection.quantity
    totalCents += totalAmount
    lines.push({
      kind: "base",
      // Prefer the specific room/unit name ("Standard - Single"); fall back to
      // the option name, then the product name.
      label:
        selection.optionUnitName ?? optionsById.get(selection.optionId)?.name ?? input.product.name,
      quantity: selection.quantity,
      unitAmount,
      totalAmount,
    })
  }

  return { totalCents, lines }
}

export function bookingItemLinesFromOptionSelections(
  selections: ReadonlyArray<NormalizedOptionSelection>,
): BookingCreateBridgeInput["itemLines"] | undefined {
  const lines = selections.flatMap((selection) =>
    selection.optionUnitId
      ? [
          {
            optionId: selection.optionId,
            optionUnitId: selection.optionUnitId,
            quantity: selection.quantity,
          },
        ]
      : [],
  )
  return lines.length > 0 ? lines : undefined
}

export function applyAddonSelections(input: {
  priced: PricedQuote
  addons: DraftLike["addons"] | undefined
  addonCatalog: ReadonlyArray<AddonOffer>
  effectivePax: number
}): PricedQuote {
  const extraLines = bookingExtraLinesFromAddonSelections({
    addons: input.addons,
    addonCatalog: input.addonCatalog,
    currency: "EUR",
  })
  if (!extraLines?.length) return input.priced

  const lines: PricedLine[] = [...input.priced.lines]
  let totalCents = input.priced.totalCents
  for (const extra of extraLines) {
    const unitAmount = extra.unitSellAmountCents ?? 0
    const quantity =
      extra.pricingMode === "per_person" || extra.pricedPerPerson
        ? Math.max(1, input.effectivePax) * extra.quantity
        : extra.quantity
    const totalAmount = unitAmount * quantity
    if (totalAmount <= 0) continue
    totalCents += totalAmount
    lines.push({
      kind: "addon",
      label: extra.name,
      quantity,
      unitAmount,
      totalAmount,
    })
  }
  return { totalCents, lines }
}

export function bookingExtraLinesFromAddonSelections(input: {
  addons: DraftLike["addons"] | undefined
  addonCatalog: ReadonlyArray<AddonOffer> | undefined
  currency: string
  quantityMultiplier?: number
}): BookingCreateBridgeInput["extraLines"] | undefined {
  if (!Array.isArray(input.addons) || input.addons.length === 0) return undefined
  const catalogById = new Map((input.addonCatalog ?? []).map((offer) => [offer.id, offer]))
  const lines = input.addons.flatMap((selection) => {
    const offer = catalogById.get(selection.extraId)
    const quantity =
      typeof selection.quantity === "number" && Number.isFinite(selection.quantity)
        ? Math.floor(selection.quantity)
        : 0
    if (!offer || quantity <= 0) return []
    const unitSellAmountCents = offer.unitAmountCents ?? null
    const chargedQuantity =
      offer.pricingMode === "per_person" || offer.pricedPerPerson
        ? quantity * Math.max(1, input.quantityMultiplier ?? 1)
        : quantity
    return [
      {
        productExtraId: offer.id,
        name: offer.name,
        description: offer.description ?? null,
        pricingMode: offer.pricingMode ?? null,
        pricedPerPerson: offer.pricedPerPerson ?? null,
        quantity,
        sellCurrency: offer.currency ?? input.currency,
        unitSellAmountCents,
        totalSellAmountCents:
          unitSellAmountCents == null ? null : unitSellAmountCents * chargedQuantity,
      },
    ]
  })
  return lines.length > 0 ? lines : undefined
}

/**
 * Three-way price computation:
 *
 * 1. **Per-band** (preferred): when `resolvedPrice.unitPrices` matches
 *    at least one band with positive count, sum `pax[band] ×
 *    unit.sellAmountCents` for each matching band. One breakdown line
 *    per band.
 *
 * 2. **Per-booking**: when no per-band match but `baseSellAmountCents`
 *    is set, charge a single `base × paxCount` line.
 *
 * 3. **Fallback**: `product.sellAmountCents × paxCount`. Same shape as
 *    Phase A behavior, kept for bookings without an option/slot
 *    configured yet.
 */
export function priceQuote(input: {
  product: typeof products.$inferSelect
  resolvedPrice: ResolvedOptionPrice | null
  pax: Partial<Record<string, number>> | undefined
  effectivePax: number
}): PricedQuote {
  const { product, resolvedPrice, pax, effectivePax } = input

  if (resolvedPrice && resolvedPrice.unitPrices.length > 0) {
    const bandLines: PricedLine[] = []
    let total = 0
    for (const unit of resolvedPrice.unitPrices) {
      if (!unit.travelerCategory) continue
      const count = pax?.[unit.travelerCategory] ?? 0
      if (count <= 0) continue
      const sell = unit.sellAmountCents ?? 0
      if (sell <= 0) continue
      const lineTotal = sell * count
      total += lineTotal
      bandLines.push({
        kind: "base",
        label: `${product.name} — ${unit.travelerCategory}`,
        quantity: count,
        unitAmount: sell,
        totalAmount: lineTotal,
      })
    }
    if (bandLines.length > 0) {
      return { totalCents: total, lines: bandLines }
    }
  }

  if (resolvedPrice && resolvedPrice.baseSellAmountCents !== null) {
    const unitCents = resolvedPrice.baseSellAmountCents
    const totalCents = unitCents * effectivePax
    return {
      totalCents,
      lines: [
        {
          kind: "base",
          label: product.name,
          quantity: effectivePax,
          unitAmount: unitCents,
          totalAmount: totalCents,
        },
      ],
    }
  }

  const unitCents = product.sellAmountCents ?? 0
  const totalCents = unitCents * effectivePax
  return {
    totalCents,
    lines: [
      {
        kind: "base",
        label: product.name,
        quantity: effectivePax,
        unitAmount: unitCents,
        totalAmount: totalCents,
      },
    ],
  }
}

export function readInitialStatus(
  parameters: Record<string, unknown> | undefined,
): BookingCreateBridgeInput["initialStatus"] {
  const allowed: ReadonlyArray<NonNullable<BookingCreateBridgeInput["initialStatus"]>> = [
    "draft",
    "on_hold",
    "awaiting_payment",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "expired",
  ]
  const raw = parameters?.initialStatus
  return typeof raw === "string" && (allowed as ReadonlyArray<string>).includes(raw)
    ? (raw as BookingCreateBridgeInput["initialStatus"])
    : undefined
}

export function extractInternalNotes(
  party: Record<string, unknown> | undefined,
): string | undefined {
  if (!party) return undefined
  const v = party.internalNotes
  return typeof v === "string" && v.length > 0 ? v : undefined
}

export function extractBillingParty(party: Record<string, unknown> | undefined): {
  personId?: string | null
  organizationId?: string | null
  contactFirstName?: string | null
  contactLastName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
} {
  const directBilling = asRecord(party?.billing)
  const travelerParty = asRecord(party?.travelerParty)
  const envelopeBilling = asRecord(travelerParty?.billing)
  const billing = envelopeBilling ?? directBilling
  const contact = asRecord(billing?.contact)

  return {
    personId: stringValue(party?.personId) ?? stringValue(billing?.personId),
    organizationId: stringValue(party?.organizationId) ?? stringValue(billing?.organizationId),
    contactFirstName: stringValue(contact?.firstName),
    contactLastName: stringValue(contact?.lastName),
    contactEmail: stringValue(contact?.email),
    contactPhone: stringValue(contact?.phone),
  }
}

// Mirrors `isRealEmail` in @voyant-travel/finance's `requireCompleteBookingParty`
// (and the trips copy). The owned booking handler resolves a CRM person from the
// billing contact before calling `createBooking`, which rejects a blank or
// placeholder email — so the resolver must apply the same rule up front, or it
// orphans a CRM person on every failed checkout. Keep this set in sync with
// finance's `placeholderEmails`.
const placeholderBillingEmails = new Set([
  "noreply@example.com",
  "tbd@example.com",
  "traveler@example.com",
])

export function isRealBillingEmail(value: string | null | undefined): value is string {
  const normalized = value?.trim().toLowerCase() ?? ""
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !placeholderBillingEmails.has(normalized)
}

export function extractPartyTravelers(
  party: Record<string, unknown> | undefined,
): Array<{ personId?: string | null }> {
  const travelerParty = asRecord(party?.travelerParty)
  const travelers = Array.isArray(travelerParty?.travelers) ? travelerParty.travelers : []
  return travelers.map((traveler) => ({
    personId: stringValue(asRecord(traveler)?.personId),
  }))
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function extractTaxLines(
  pricing: CommitOwnedRequest["pricing"],
): BookingCreateBridgeInput["taxLines"] {
  const breakdown = pricing?.breakdown
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return undefined
  const taxes = (breakdown as { taxes?: unknown }).taxes
  if (!Array.isArray(taxes)) return undefined

  const lines: NonNullable<BookingCreateBridgeInput["taxLines"]> = []
  for (const [index, tax] of taxes.entries()) {
    if (!tax || typeof tax !== "object" || Array.isArray(tax)) continue
    const row = tax as Record<string, unknown>
    const amountCents = asFiniteInteger(row.amount)
    const rate = typeof row.rate === "number" && Number.isFinite(row.rate) ? row.rate : null
    const currency =
      typeof pricing?.currency === "string" && pricing.currency.length === 3
        ? pricing.currency
        : "EUR"
    const name = typeof row.label === "string" && row.label.length > 0 ? row.label : "Tax"
    if (!amountCents || amountCents <= 0) continue
    const includedInPrice = row.includedInPrice === true || row.scope === "included"
    lines.push({
      code: typeof row.code === "string" ? row.code : null,
      name,
      scope: includedInPrice ? "included" : "excluded",
      currency,
      amountCents,
      rateBasisPoints: rate == null ? null : Math.round(rate * 10_000),
      includedInPrice,
      sortOrder: index,
    })
  }

  return lines.length ? lines : undefined
}

export function resolveSellAmountCentsOverride(
  pricing: CommitOwnedRequest["pricing"],
): number | null {
  if (!pricing) return null
  const breakdown = pricing.breakdown
  if (hasInclusiveTaxLine(breakdown)) {
    const total = readBreakdownTotal(breakdown)
    if (total != null) return total
  }
  return pricing.base_amount != null ? Math.round(pricing.base_amount) : null
}

export function hasInclusiveTaxLine(breakdown: unknown): boolean {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return false
  const taxes = (breakdown as { taxes?: unknown }).taxes
  if (!Array.isArray(taxes)) return false
  return taxes.some((tax) => {
    if (!tax || typeof tax !== "object" || Array.isArray(tax)) return false
    const row = tax as Record<string, unknown>
    return row.includedInPrice === true || row.scope === "included"
  })
}

export function readBreakdownTotal(breakdown: unknown): number | null {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return null
  const total = (breakdown as { total?: unknown }).total
  return typeof total === "number" && Number.isFinite(total) ? Math.round(total) : null
}

export function asFiniteInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

export function defaultBookingNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  return `BK-${ts}`
}
