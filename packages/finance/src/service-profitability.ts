import { bookingItems } from "@voyantjs/bookings/schema"
import type {
  DepartureProfitabilityQuery,
  ProductProfitabilityQuery,
} from "@voyantjs/finance-contracts"
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type FxMoneyInput, resolveFxMoneyBaseAmount } from "./fx-money.js"
import {
  invoices,
  supplierCostAllocations,
  supplierInvoiceLines,
  supplierInvoices,
} from "./schema.js"

/**
 * Profitability read model (RFC §8). Computed on read, never stored. Amounts are
 * grouped **per currency** and never summed across currencies (no FX in v1).
 *
 * - Revenue  = issued customer invoices (AR), attributed to a departure by
 *   splitting each booking's invoiced total across its departures in proportion
 *   to the departures' booked sell amounts (`booking_items`). Credit notes net
 *   the revenue down.
 * - Actual cost = `supplier_cost_allocations` targeted at the departure/product.
 * - Planned cost = `booking_items.totalCostAmountCents` (what we expected to pay).
 * - Profit = revenue − actual cost. Variance = planned − actual cost.
 */

export interface ProfitabilityCostByServiceType {
  serviceType: string
  currency: string
  amountCents: number
}

export interface ProfitabilityUnattributed {
  currency: string
  amountCents: number
}

export interface DepartureProfitabilityRow {
  departureId: string
  departureLabel: string | null
  productId: string | null
  productName: string | null
  departureDate: string | null
  currency: string
  revenueCents: number
  actualCostCents: number
  plannedCostCents: number
  profitCents: number
  marginPercent: number | null
  varianceCents: number
}

export interface DepartureProfitabilityBaseRollup {
  currency: string
  rows: DepartureProfitabilityRow[]
  costByServiceType: ProfitabilityCostByServiceType[]
  unattributedCents: number
  /** Source currencies with no resolvable FX rate — excluded from the rollup. */
  unconvertibleCurrencies: string[]
}

export interface DepartureProfitabilityReport {
  rows: DepartureProfitabilityRow[]
  costByServiceType: ProfitabilityCostByServiceType[]
  unattributed: ProfitabilityUnattributed[]
  base?: DepartureProfitabilityBaseRollup
}

export interface ProductProfitabilityRow {
  productId: string
  productName: string | null
  currency: string
  departureCount: number
  revenueCents: number
  actualCostCents: number
  plannedCostCents: number
  profitCents: number
  marginPercent: number | null
  varianceCents: number
}

export interface ProductProfitabilityBaseRollup {
  currency: string
  rows: ProductProfitabilityRow[]
  costByServiceType: ProfitabilityCostByServiceType[]
  unattributedCents: number
  unconvertibleCurrencies: string[]
}

export interface ProductProfitabilityReport {
  rows: ProductProfitabilityRow[]
  costByServiceType: ProfitabilityCostByServiceType[]
  unattributed: ProfitabilityUnattributed[]
  base?: ProductProfitabilityBaseRollup
}

interface CurrencyTotals {
  revenue: number
  actual: number
  planned: number
}

interface DepartureAcc {
  departureId: string
  productId: string | null
  productName: string | null
  departureLabel: string | null
  departureDate: string | null
  byCurrency: Map<string, CurrencyTotals>
}

const num = (value: unknown): number => Number(value ?? 0)

function bucket(map: Map<string, CurrencyTotals>, currency: string): CurrencyTotals {
  let entry = map.get(currency)
  if (!entry) {
    entry = { revenue: 0, actual: 0, planned: 0 }
    map.set(currency, entry)
  }
  return entry
}

function margin(profitCents: number, revenueCents: number): number | null {
  if (revenueCents <= 0) return null
  return Math.round((profitCents / revenueCents) * 1000) / 10
}

/**
 * Shared loader: runs the source queries once and assembles a per-departure
 * accumulator plus the cost-breakdown aggregates that both reports surface.
 */
async function loadDepartureAccumulators(db: PostgresJsDatabase): Promise<{
  departures: Map<string, DepartureAcc>
  productActualCost: Array<{ productId: string; currency: string; amountCents: number }>
  costByServiceType: ProfitabilityCostByServiceType[]
  unattributed: ProfitabilityUnattributed[]
}> {
  const [
    itemRows,
    invoiceRows,
    departureCostRows,
    productCostRows,
    serviceTypeRows,
    unattributedRows,
  ] = await Promise.all([
    // Booked sell + planned cost per (departure, booking), with display snapshots.
    db
      .select({
        departureId: bookingItems.availabilitySlotId,
        bookingId: bookingItems.bookingId,
        productId: sql<string | null>`max(${bookingItems.productId})`,
        productName: sql<string | null>`max(${bookingItems.productNameSnapshot})`,
        departureLabel: sql<string | null>`max(${bookingItems.departureLabelSnapshot})`,
        departureDate: sql<
          string | null
        >`to_char(min(${bookingItems.startsAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
        sellCurrency: bookingItems.sellCurrency,
        sellCents: sql<number>`coalesce(sum(${bookingItems.totalSellAmountCents}), 0)::bigint`,
        costCurrency: bookingItems.costCurrency,
        plannedCostCents: sql<number>`coalesce(sum(${bookingItems.totalCostAmountCents}), 0)::bigint`,
      })
      .from(bookingItems)
      .where(isNotNull(bookingItems.availabilitySlotId))
      .groupBy(
        bookingItems.availabilitySlotId,
        bookingItems.bookingId,
        bookingItems.sellCurrency,
        bookingItems.costCurrency,
      ),
    // Invoiced AR per (booking, currency). Credit notes net down; proforma/draft/void excluded.
    db
      .select({
        bookingId: invoices.bookingId,
        currency: invoices.currency,
        totalCents: sql<number>`coalesce(sum(case when ${invoices.invoiceType} = 'credit_note' then -${invoices.totalCents} else ${invoices.totalCents} end), 0)::bigint`,
      })
      .from(invoices)
      .where(
        and(
          ne(invoices.status, "void"),
          ne(invoices.status, "draft"),
          ne(invoices.invoiceType, "proforma"),
        ),
      )
      .groupBy(invoices.bookingId, invoices.currency),
    // Actual cost: departure-targeted allocations per (departure, currency).
    db
      .select({
        departureId: supplierCostAllocations.departureId,
        currency: supplierInvoices.currency,
        amountCents: sql<number>`coalesce(sum(${supplierCostAllocations.amountCents}), 0)::bigint`,
      })
      .from(supplierCostAllocations)
      .innerJoin(
        supplierInvoices,
        eq(supplierCostAllocations.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(supplierCostAllocations.targetType, "departure"),
          isNotNull(supplierCostAllocations.departureId),
          ne(supplierInvoices.status, "void"),
          isNull(supplierInvoices.deletedAt),
        ),
      )
      .groupBy(supplierCostAllocations.departureId, supplierInvoices.currency),
    // Actual cost: product-targeted allocations per (product, currency) — not tied to a departure.
    db
      .select({
        productId: supplierCostAllocations.productId,
        currency: supplierInvoices.currency,
        amountCents: sql<number>`coalesce(sum(${supplierCostAllocations.amountCents}), 0)::bigint`,
      })
      .from(supplierCostAllocations)
      .innerJoin(
        supplierInvoices,
        eq(supplierCostAllocations.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(supplierCostAllocations.targetType, "product"),
          isNotNull(supplierCostAllocations.productId),
          ne(supplierInvoices.status, "void"),
          isNull(supplierInvoices.deletedAt),
        ),
      )
      .groupBy(supplierCostAllocations.productId, supplierInvoices.currency),
    // Cost breakdown by supplier service type (attributed allocations only).
    db
      .select({
        serviceType: sql<string>`coalesce(${supplierInvoiceLines.serviceType}, 'other')`,
        currency: supplierInvoices.currency,
        amountCents: sql<number>`coalesce(sum(${supplierCostAllocations.amountCents}), 0)::bigint`,
      })
      .from(supplierCostAllocations)
      .innerJoin(
        supplierInvoices,
        eq(supplierCostAllocations.supplierInvoiceId, supplierInvoices.id),
      )
      .leftJoin(
        supplierInvoiceLines,
        eq(supplierCostAllocations.supplierInvoiceLineId, supplierInvoiceLines.id),
      )
      .where(
        and(
          inArray(supplierCostAllocations.targetType, [
            "departure",
            "product",
            "booking",
            "traveler",
          ]),
          ne(supplierInvoices.status, "void"),
          isNull(supplierInvoices.deletedAt),
        ),
      )
      .groupBy(
        sql`coalesce(${supplierInvoiceLines.serviceType}, 'other')`,
        supplierInvoices.currency,
      ),
    // Recorded-but-unattributed cost — appears in AP totals, excluded from P&L.
    db
      .select({
        currency: supplierInvoices.currency,
        amountCents: sql<number>`coalesce(sum(${supplierCostAllocations.amountCents}), 0)::bigint`,
      })
      .from(supplierCostAllocations)
      .innerJoin(
        supplierInvoices,
        eq(supplierCostAllocations.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(supplierCostAllocations.targetType, "unattributed"),
          ne(supplierInvoices.status, "void"),
          isNull(supplierInvoices.deletedAt),
        ),
      )
      .groupBy(supplierInvoices.currency),
  ])

  const departures = new Map<string, DepartureAcc>()
  const ensure = (departureId: string): DepartureAcc => {
    let acc = departures.get(departureId)
    if (!acc) {
      acc = {
        departureId,
        productId: null,
        productName: null,
        departureLabel: null,
        departureDate: null,
        byCurrency: new Map(),
      }
      departures.set(departureId, acc)
    }
    return acc
  }

  // Booking totals + per-departure sell, for proportional revenue attribution.
  const bookingTotalSell = new Map<string, number>()
  const bookingSlotSell = new Map<string, Array<{ departureId: string; sellCents: number }>>()

  for (const row of itemRows) {
    const departureId = row.departureId
    if (!departureId) continue
    const acc = ensure(departureId)
    acc.productId ??= row.productId
    acc.productName ??= row.productName
    acc.departureLabel ??= row.departureLabel
    acc.departureDate ??= row.departureDate

    const sellCents = num(row.sellCents)
    const plannedCost = num(row.plannedCostCents)
    if (row.costCurrency && plannedCost !== 0) {
      bucket(acc.byCurrency, row.costCurrency).planned += plannedCost
    }

    bookingTotalSell.set(row.bookingId, (bookingTotalSell.get(row.bookingId) ?? 0) + sellCents)
    const slots = bookingSlotSell.get(row.bookingId) ?? []
    slots.push({ departureId, sellCents })
    bookingSlotSell.set(row.bookingId, slots)
  }

  // Attribute invoiced AR to departures proportionally by sell amount. Bookings
  // with zero sell split equally across their distinct departures.
  const invoicesByBooking = new Map<string, Array<{ currency: string; totalCents: number }>>()
  for (const row of invoiceRows) {
    const list = invoicesByBooking.get(row.bookingId) ?? []
    list.push({ currency: row.currency, totalCents: num(row.totalCents) })
    invoicesByBooking.set(row.bookingId, list)
  }

  for (const [bookingId, invoiceList] of invoicesByBooking) {
    const slots = bookingSlotSell.get(bookingId)
    if (!slots || slots.length === 0) continue // invoice for a booking with no slotted items → not departure-attributable
    const totalSell = bookingTotalSell.get(bookingId) ?? 0
    for (const slot of slots) {
      const ratio = totalSell > 0 ? slot.sellCents / totalSell : 1 / slots.length
      const acc = ensure(slot.departureId)
      for (const inv of invoiceList) {
        bucket(acc.byCurrency, inv.currency).revenue += inv.totalCents * ratio
      }
    }
  }

  for (const row of departureCostRows) {
    if (!row.departureId) continue
    bucket(ensure(row.departureId).byCurrency, row.currency).actual += num(row.amountCents)
  }

  const productActualCost = productCostRows
    .filter((row): row is { productId: string; currency: string; amountCents: number } =>
      Boolean(row.productId),
    )
    .map((row) => ({
      productId: row.productId,
      currency: row.currency,
      amountCents: num(row.amountCents),
    }))

  const costByServiceType = serviceTypeRows
    .map((row) => ({
      serviceType: row.serviceType,
      currency: row.currency,
      amountCents: num(row.amountCents),
    }))
    .filter((row) => row.amountCents !== 0)

  const unattributed = unattributedRows
    .map((row) => ({ currency: row.currency, amountCents: num(row.amountCents) }))
    .filter((row) => row.amountCents !== 0)

  return { departures, productActualCost, costByServiceType, unattributed }
}

function withinDateRange(date: string | null, from?: string, to?: string): boolean {
  if (!from && !to) return true
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function getDepartureProfitability(
  db: PostgresJsDatabase,
  query: DepartureProfitabilityQuery,
): Promise<DepartureProfitabilityReport> {
  const { departures, costByServiceType, unattributed } = await loadDepartureAccumulators(db)

  const rows: DepartureProfitabilityRow[] = []
  for (const acc of departures.values()) {
    if (query.departureId && acc.departureId !== query.departureId) continue
    if (query.productId && acc.productId !== query.productId) continue
    if (!withinDateRange(acc.departureDate, query.from, query.to)) continue

    for (const [currency, totals] of acc.byCurrency) {
      if (query.currency && currency !== query.currency) continue
      const revenueCents = Math.round(totals.revenue)
      const actualCostCents = Math.round(totals.actual)
      const plannedCostCents = Math.round(totals.planned)
      const profitCents = revenueCents - actualCostCents
      rows.push({
        departureId: acc.departureId,
        departureLabel: acc.departureLabel,
        productId: acc.productId,
        productName: acc.productName,
        departureDate: acc.departureDate,
        currency,
        revenueCents,
        actualCostCents,
        plannedCostCents,
        profitCents,
        marginPercent: margin(profitCents, revenueCents),
        varianceCents: plannedCostCents - actualCostCents,
      })
    }
  }

  rows.sort(
    (a, b) =>
      (a.departureDate ?? "").localeCompare(b.departureDate ?? "") ||
      a.departureId.localeCompare(b.departureId) ||
      a.currency.localeCompare(b.currency),
  )

  const report: DepartureProfitabilityReport = {
    rows,
    costByServiceType: filterCostByCurrency(costByServiceType, query.currency),
    unattributed: filterCostByCurrency(unattributed, query.currency),
  }
  if (query.baseCurrency) {
    const base = query.baseCurrency.toUpperCase()
    const { rates, unconvertible } = await buildBaseRates(
      db,
      [...rows, ...costByServiceType, ...unattributed].map((r) => r.currency),
      base,
    )
    report.base = {
      currency: base,
      rows: rollupDepartureRowsToBase(rows, rates, base),
      costByServiceType: rollupCostByServiceTypeToBase(costByServiceType, rates, base),
      unattributedCents: rollupAmountToBase(unattributed, rates),
      unconvertibleCurrencies: unconvertible,
    }
  }
  return report
}

export async function getProductProfitability(
  db: PostgresJsDatabase,
  query: ProductProfitabilityQuery,
): Promise<ProductProfitabilityReport> {
  const { departures, productActualCost, costByServiceType, unattributed } =
    await loadDepartureAccumulators(db)

  interface ProductAcc {
    productId: string
    productName: string | null
    byCurrency: Map<string, CurrencyTotals & { departures: Set<string> }>
  }
  const products = new Map<string, ProductAcc>()
  const ensureProduct = (productId: string): ProductAcc => {
    let acc = products.get(productId)
    if (!acc) {
      acc = { productId, productName: null, byCurrency: new Map() }
      products.set(productId, acc)
    }
    return acc
  }
  const productBucket = (acc: ProductAcc, currency: string) => {
    let entry = acc.byCurrency.get(currency)
    if (!entry) {
      entry = { revenue: 0, actual: 0, planned: 0, departures: new Set() }
      acc.byCurrency.set(currency, entry)
    }
    return entry
  }

  for (const dep of departures.values()) {
    if (!dep.productId) continue
    if (!withinDateRange(dep.departureDate, query.from, query.to)) continue
    const acc = ensureProduct(dep.productId)
    acc.productName ??= dep.productName
    for (const [currency, totals] of dep.byCurrency) {
      if (query.currency && currency !== query.currency) continue
      const entry = productBucket(acc, currency)
      entry.revenue += totals.revenue
      entry.actual += totals.actual
      entry.planned += totals.planned
      entry.departures.add(dep.departureId)
    }
  }

  // Product-level allocations (cost attributed to a product, not a departure).
  for (const row of productActualCost) {
    if (query.currency && row.currency !== query.currency) continue
    productBucket(ensureProduct(row.productId), row.currency).actual += row.amountCents
  }

  const rows: ProductProfitabilityRow[] = []
  for (const acc of products.values()) {
    for (const [currency, totals] of acc.byCurrency) {
      const revenueCents = Math.round(totals.revenue)
      const actualCostCents = Math.round(totals.actual)
      const plannedCostCents = Math.round(totals.planned)
      const profitCents = revenueCents - actualCostCents
      rows.push({
        productId: acc.productId,
        productName: acc.productName,
        currency,
        departureCount: totals.departures.size,
        revenueCents,
        actualCostCents,
        plannedCostCents,
        profitCents,
        marginPercent: margin(profitCents, revenueCents),
        varianceCents: plannedCostCents - actualCostCents,
      })
    }
  }

  rows.sort(
    (a, b) => a.productId.localeCompare(b.productId) || a.currency.localeCompare(b.currency),
  )

  const report: ProductProfitabilityReport = {
    rows,
    costByServiceType: filterCostByCurrency(costByServiceType, query.currency),
    unattributed: filterCostByCurrency(unattributed, query.currency),
  }
  if (query.baseCurrency) {
    const base = query.baseCurrency.toUpperCase()
    const { rates, unconvertible } = await buildBaseRates(
      db,
      [...rows, ...costByServiceType, ...unattributed].map((r) => r.currency),
      base,
    )
    report.base = {
      currency: base,
      rows: rollupProductRowsToBase(rows, rates, base),
      costByServiceType: rollupCostByServiceTypeToBase(costByServiceType, rates, base),
      unattributedCents: rollupAmountToBase(unattributed, rates),
      unconvertibleCurrencies: unconvertible,
    }
  }
  return report
}

function filterCostByCurrency<T extends { currency: string }>(rows: T[], currency?: string): T[] {
  return currency ? rows.filter((row) => row.currency === currency) : rows
}

// ---------- base-currency rollup (FX) ----------

/**
 * Resolve a conversion rate for each source currency → base via persisted FX
 * rates (one probe per distinct currency, cached). Currencies with no rate are
 * reported as unconvertible and excluded from the rollup rather than guessed.
 */
async function buildBaseRates(
  db: PostgresJsDatabase,
  currencies: Iterable<string>,
  base: string,
): Promise<{ rates: Map<string, number>; unconvertible: string[] }> {
  const rates = new Map<string, number>()
  const unconvertible: string[] = []
  for (const currency of new Set(currencies)) {
    if (currency === base) {
      rates.set(currency, 1)
      continue
    }
    const probeInput: FxMoneyInput = { amountCents: 1_000_000, currency }
    const probe = await resolveFxMoneyBaseAmount(db, probeInput, { targetBaseCurrency: base })
    if (probe.baseAmountCents != null && probe.baseCurrency === base) {
      rates.set(currency, probe.baseAmountCents / 1_000_000)
    } else {
      unconvertible.push(currency)
    }
  }
  return { rates, unconvertible }
}

function rollupDepartureRowsToBase(
  rows: DepartureProfitabilityRow[],
  rates: Map<string, number>,
  base: string,
): DepartureProfitabilityRow[] {
  const acc = new Map<
    string,
    { template: DepartureProfitabilityRow; revenue: number; actual: number; planned: number }
  >()
  for (const row of rows) {
    const rate = rates.get(row.currency)
    if (rate == null) continue
    let entry = acc.get(row.departureId)
    if (!entry) {
      entry = { template: row, revenue: 0, actual: 0, planned: 0 }
      acc.set(row.departureId, entry)
    }
    entry.revenue += row.revenueCents * rate
    entry.actual += row.actualCostCents * rate
    entry.planned += row.plannedCostCents * rate
  }
  const out = [...acc.values()].map(({ template, revenue, actual, planned }) => {
    const revenueCents = Math.round(revenue)
    const actualCostCents = Math.round(actual)
    const plannedCostCents = Math.round(planned)
    const profitCents = revenueCents - actualCostCents
    return {
      ...template,
      currency: base,
      revenueCents,
      actualCostCents,
      plannedCostCents,
      profitCents,
      marginPercent: margin(profitCents, revenueCents),
      varianceCents: plannedCostCents - actualCostCents,
    }
  })
  out.sort(
    (a, b) =>
      (a.departureDate ?? "").localeCompare(b.departureDate ?? "") ||
      a.departureId.localeCompare(b.departureId),
  )
  return out
}

function rollupProductRowsToBase(
  rows: ProductProfitabilityRow[],
  rates: Map<string, number>,
  base: string,
): ProductProfitabilityRow[] {
  const acc = new Map<
    string,
    {
      template: ProductProfitabilityRow
      revenue: number
      actual: number
      planned: number
      departureCount: number
    }
  >()
  for (const row of rows) {
    const rate = rates.get(row.currency)
    if (rate == null) continue
    let entry = acc.get(row.productId)
    if (!entry) {
      entry = { template: row, revenue: 0, actual: 0, planned: 0, departureCount: 0 }
      acc.set(row.productId, entry)
    }
    entry.revenue += row.revenueCents * rate
    entry.actual += row.actualCostCents * rate
    entry.planned += row.plannedCostCents * rate
    // Approximate: a departure usually trades in a single currency, so the
    // largest per-currency count is the best distinct-count proxy.
    entry.departureCount = Math.max(entry.departureCount, row.departureCount)
  }
  const out = [...acc.values()].map(({ template, revenue, actual, planned, departureCount }) => {
    const revenueCents = Math.round(revenue)
    const actualCostCents = Math.round(actual)
    const plannedCostCents = Math.round(planned)
    const profitCents = revenueCents - actualCostCents
    return {
      ...template,
      currency: base,
      departureCount,
      revenueCents,
      actualCostCents,
      plannedCostCents,
      profitCents,
      marginPercent: margin(profitCents, revenueCents),
      varianceCents: plannedCostCents - actualCostCents,
    }
  })
  out.sort((a, b) => a.productId.localeCompare(b.productId))
  return out
}

function rollupCostByServiceTypeToBase(
  rows: ProfitabilityCostByServiceType[],
  rates: Map<string, number>,
  base: string,
): ProfitabilityCostByServiceType[] {
  const byType = new Map<string, number>()
  for (const row of rows) {
    const rate = rates.get(row.currency)
    if (rate == null) continue
    byType.set(
      row.serviceType,
      (byType.get(row.serviceType) ?? 0) + Math.round(row.amountCents * rate),
    )
  }
  return [...byType.entries()]
    .map(([serviceType, amountCents]) => ({ serviceType, currency: base, amountCents }))
    .filter((row) => row.amountCents !== 0)
}

function rollupAmountToBase(
  rows: Array<{ currency: string; amountCents: number }>,
  rates: Map<string, number>,
): number {
  let total = 0
  for (const row of rows) {
    const rate = rates.get(row.currency)
    if (rate == null) continue
    total += Math.round(row.amountCents * rate)
  }
  return total
}

// ---------- CSV export (accountant sharing) ----------

const csvField = (value: string | number | null | undefined): string => {
  const str = value == null ? "" : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}
const csvRow = (cells: Array<string | number | null | undefined>): string =>
  cells.map(csvField).join(",")
// BOM + CRLF so Excel opens UTF-8 correctly (mirrors availability exports).
const csvDocument = (rows: string[]): string => `﻿${rows.join("\r\n")}\r\n`
const major = (cents: number): string => (cents / 100).toFixed(2)
const marginCell = (value: number | null): string => (value == null ? "" : value.toFixed(1))

export function buildDepartureProfitabilityCsv(report: DepartureProfitabilityReport): string {
  const header = [
    "departure_id",
    "departure",
    "product_id",
    "product",
    "date",
    "currency",
    "revenue",
    "actual_cost",
    "planned_cost",
    "profit",
    "margin_percent",
    "variance",
  ]
  const rows = report.rows.map((r) =>
    csvRow([
      r.departureId,
      r.departureLabel,
      r.productId,
      r.productName,
      r.departureDate,
      r.currency,
      major(r.revenueCents),
      major(r.actualCostCents),
      major(r.plannedCostCents),
      major(r.profitCents),
      marginCell(r.marginPercent),
      major(r.varianceCents),
    ]),
  )
  return csvDocument([csvRow(header), ...rows])
}

export function buildProductProfitabilityCsv(report: ProductProfitabilityReport): string {
  const header = [
    "product_id",
    "product",
    "currency",
    "departures",
    "revenue",
    "actual_cost",
    "planned_cost",
    "profit",
    "margin_percent",
    "variance",
  ]
  const rows = report.rows.map((r) =>
    csvRow([
      r.productId,
      r.productName,
      r.currency,
      r.departureCount,
      major(r.revenueCents),
      major(r.actualCostCents),
      major(r.plannedCostCents),
      major(r.profitCents),
      marginCell(r.marginPercent),
      major(r.varianceCents),
    ]),
  )
  return csvDocument([csvRow(header), ...rows])
}
