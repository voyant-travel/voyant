import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger"
import { type AnyColumn, and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { supplierCostAllocations, supplierInvoiceLines, supplierInvoices } from "./schema.js"
import {
  buildSupplierInvoiceAllocationsActionLedgerInput,
  buildSupplierInvoiceCreateActionLedgerInput,
  buildSupplierInvoiceDeleteActionLedgerInput,
  buildSupplierInvoiceUpdateActionLedgerInput,
} from "./service-action-ledger-supplier-invoices.js"
import type {
  insertSupplierInvoiceSchema,
  setSupplierCostAllocationsSchema,
  setSupplierInvoiceLinesSchema,
  supplierCostAllocationInputSchema,
  supplierInvoiceLineInputSchema,
  supplierInvoiceListQuerySchema,
  updateSupplierInvoiceSchema,
} from "./validation.js"

type CreateSupplierInvoiceInput = z.infer<typeof insertSupplierInvoiceSchema>
type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>
type SupplierInvoiceListQuery = z.infer<typeof supplierInvoiceListQuerySchema>
type SupplierInvoiceLineInput = z.infer<typeof supplierInvoiceLineInputSchema>
type SupplierCostAllocationInput = z.infer<typeof supplierCostAllocationInputSchema>
type SetLinesInput = z.infer<typeof setSupplierInvoiceLinesSchema>
type SetAllocationsInput = z.infer<typeof setSupplierCostAllocationsSchema>

export type SupplierInvoiceErrorCode =
  | "supplier_invoice_not_found"
  | "mixed_allocation_modes"
  | "over_allocated"
  | "unknown_allocation_line"
  | "allocate_lines_after_create"

/**
 * Raised by the supplier-invoice (AP) service. Route handlers map `code` to HTTP.
 */
export class SupplierInvoiceServiceError extends Error {
  constructor(
    readonly code: SupplierInvoiceErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "SupplierInvoiceServiceError"
  }
}

export interface SupplierInvoiceServiceRuntime {
  actionLedgerContext?: ActionLedgerRequestContextValues
  actionLedgerAuthorizationSource?: string | null
}

// ---------- pure helpers (unit-testable, no DB) ----------

export interface InvoiceTotals {
  subtotalCents: number
  taxCents: number
  totalCents: number
}

/**
 * Totals derived from lines. `total` is the sum of line totals (which already
 * include tax); `tax` is the sum of line tax; `subtotal = total − tax`. This is
 * internally consistent regardless of per-line unit×qty rounding.
 */
export function recomputeTotalsFromLines(
  lines: readonly SupplierInvoiceLineInput[],
): InvoiceTotals {
  let tax = 0
  let total = 0
  for (const line of lines) {
    tax += line.taxAmountCents ?? 0
    total += line.totalAmountCents
  }
  return { subtotalCents: total - tax, taxCents: tax, totalCents: total }
}

export interface AllocationCheckLine {
  id: string
  totalAmountCents: number
}

export interface AllocationCheckEntry {
  supplierInvoiceLineId?: string | null
  amountCents: number
}

export type AllocationCheckResult =
  | { ok: true }
  | { ok: false; code: SupplierInvoiceErrorCode; message: string }

/**
 * Allocation invariants (§6.1):
 *  1. One mode per invoice — either every allocation is whole-invoice
 *     (no line id) OR every allocation is per-line. Never mixed.
 *  2. Exactly-one-target is enforced upstream by the zod schema + DB check.
 *  3. No over-allocation — Σ per line ≤ that line's total; for whole-invoice
 *     mode, Σ ≤ the invoice total.
 *  4. Under-allocation is allowed (the remainder is reported as `unattributed`
 *     by the read model, not stored).
 */
export function validateAllocations(params: {
  invoiceTotalCents: number
  lines: readonly AllocationCheckLine[]
  allocations: readonly AllocationCheckEntry[]
}): AllocationCheckResult {
  const { invoiceTotalCents, lines, allocations } = params
  if (allocations.length === 0) return { ok: true }

  const hasLineLess = allocations.some((a) => a.supplierInvoiceLineId == null)
  const hasPerLine = allocations.some((a) => a.supplierInvoiceLineId != null)
  if (hasLineLess && hasPerLine) {
    return {
      ok: false,
      code: "mixed_allocation_modes",
      message:
        "an invoice is allocated either whole-invoice or per-line, not both — split every allocation the same way",
    }
  }

  if (hasPerLine) {
    const lineTotals = new Map(lines.map((l) => [l.id, l.totalAmountCents]))
    const sums = new Map<string, number>()
    for (const a of allocations) {
      const lineId = a.supplierInvoiceLineId as string
      if (!lineTotals.has(lineId)) {
        return {
          ok: false,
          code: "unknown_allocation_line",
          message: `allocation references unknown line ${lineId}`,
        }
      }
      sums.set(lineId, (sums.get(lineId) ?? 0) + a.amountCents)
    }
    for (const [lineId, sum] of sums) {
      const total = lineTotals.get(lineId) ?? 0
      if (sum > total) {
        return {
          ok: false,
          code: "over_allocated",
          message: `line ${lineId} over-allocated (${sum} > ${total})`,
        }
      }
    }
    return { ok: true }
  }

  const sum = allocations.reduce((acc, a) => acc + a.amountCents, 0)
  if (sum > invoiceTotalCents) {
    return {
      ok: false,
      code: "over_allocated",
      message: `invoice over-allocated (${sum} > ${invoiceTotalCents})`,
    }
  }
  return { ok: true }
}

// ---------- internal mappers ----------

function allocationValues(supplierInvoiceId: string, a: SupplierCostAllocationInput) {
  return {
    supplierInvoiceId,
    supplierInvoiceLineId: a.supplierInvoiceLineId ?? null,
    targetType: a.targetType,
    departureId: a.departureId ?? null,
    productId: a.productId ?? null,
    bookingId: a.bookingId ?? null,
    bookingItemId: a.bookingItemId ?? null,
    travelerId: a.travelerId ?? null,
    amountCents: a.amountCents,
    baseAmountCents: a.baseAmountCents ?? null,
    splitMethod: a.splitMethod ?? "manual",
  }
}

function lineValues(supplierInvoiceId: string, line: SupplierInvoiceLineInput, index: number) {
  return {
    supplierInvoiceId,
    description: line.description,
    serviceType: line.serviceType ?? "other",
    supplierServiceId: line.supplierServiceId ?? null,
    quantity: line.quantity ?? 1,
    unitAmountCents: line.unitAmountCents,
    taxRateBps: line.taxRateBps ?? null,
    taxAmountCents: line.taxAmountCents ?? 0,
    totalAmountCents: line.totalAmountCents,
    sortOrder: line.sortOrder ?? index,
  }
}

async function loadSupplierInvoice(db: PostgresJsDatabase, id: string) {
  const [invoice] = await db
    .select()
    .from(supplierInvoices)
    .where(eq(supplierInvoices.id, id))
    .limit(1)
  if (!invoice) return null
  const [lines, allocations] = await Promise.all([
    db
      .select()
      .from(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.supplierInvoiceId, id))
      .orderBy(asc(supplierInvoiceLines.sortOrder)),
    db
      .select()
      .from(supplierCostAllocations)
      .where(eq(supplierCostAllocations.supplierInvoiceId, id))
      .orderBy(asc(supplierCostAllocations.createdAt)),
  ])
  return { ...invoice, lines, allocations }
}

const SORT_COLUMNS = {
  issueDate: supplierInvoices.issueDate,
  dueDate: supplierInvoices.dueDate,
  totalCents: supplierInvoices.totalCents,
  balanceDueCents: supplierInvoices.balanceDueCents,
  status: supplierInvoices.status,
  createdAt: supplierInvoices.createdAt,
} as const

export const supplierInvoicesService = {
  async list(db: PostgresJsDatabase, query: SupplierInvoiceListQuery) {
    const conditions = [isNull(supplierInvoices.deletedAt)]
    if (query.supplierId) conditions.push(eq(supplierInvoices.supplierId, query.supplierId))
    if (query.status) conditions.push(eq(supplierInvoices.status, query.status))
    if (query.currency) conditions.push(eq(supplierInvoices.currency, query.currency))
    if (query.dueDateFrom) conditions.push(sql`${supplierInvoices.dueDate} >= ${query.dueDateFrom}`)
    if (query.dueDateTo) conditions.push(sql`${supplierInvoices.dueDate} <= ${query.dueDateTo}`)
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(
          ilike(supplierInvoices.supplierInvoiceNo, term),
          ilike(supplierInvoices.internalRef, term),
          ilike(supplierInvoices.notes, term),
        )!,
      )
    }
    // Attribution filters join through the allocations table.
    const attributedTo = (column: AnyColumn, value: string) =>
      inArray(
        supplierInvoices.id,
        db
          .select({ id: supplierCostAllocations.supplierInvoiceId })
          .from(supplierCostAllocations)
          .where(eq(column, value)),
      )
    if (query.departureId) {
      conditions.push(attributedTo(supplierCostAllocations.departureId, query.departureId))
    }
    if (query.productId) {
      conditions.push(attributedTo(supplierCostAllocations.productId, query.productId))
    }
    if (query.bookingId) {
      conditions.push(attributedTo(supplierCostAllocations.bookingId, query.bookingId))
    }

    const where = and(...conditions)
    const sortColumn = SORT_COLUMNS[query.sortBy]
    const orderBy = query.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(supplierInvoices)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(orderBy),
      db.select({ count: sql<number>`count(*)::int` }).from(supplierInvoices).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getById(db: PostgresJsDatabase, id: string) {
    return loadSupplierInvoice(db, id)
  },

  async create(
    db: PostgresJsDatabase,
    input: CreateSupplierInvoiceInput,
    runtime: SupplierInvoiceServiceRuntime = {},
  ) {
    const lines = input.lines ?? []
    const allocations = input.allocations ?? []

    // Create-time allocations must be whole-invoice: new lines have no ids yet,
    // so per-line allocation has to happen via setAllocations after create.
    if (allocations.some((a) => a.supplierInvoiceLineId)) {
      throw new SupplierInvoiceServiceError(
        "allocate_lines_after_create",
        "per-line allocations must be set after the invoice (and its lines) exist",
      )
    }

    const totals = lines.length
      ? recomputeTotalsFromLines(lines)
      : {
          subtotalCents: input.subtotalCents ?? 0,
          taxCents: input.taxCents ?? 0,
          totalCents: input.totalCents ?? 0,
        }

    const check = validateAllocations({
      invoiceTotalCents: totals.totalCents,
      lines: [],
      allocations,
    })
    if (!check.ok) throw new SupplierInvoiceServiceError(check.code, check.message)

    const created = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(supplierInvoices)
        .values({
          supplierId: input.supplierId,
          supplierInvoiceNo: input.supplierInvoiceNo,
          internalRef: input.internalRef ?? null,
          status: input.status ?? "draft",
          currency: input.currency,
          baseCurrency: input.baseCurrency ?? null,
          fxRateSetId: input.fxRateSetId ?? null,
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          paidCents: 0,
          balanceDueCents: totals.totalCents,
          taxRegimeId: input.taxRegimeId ?? null,
          issueDate: input.issueDate,
          dueDate: input.dueDate ?? null,
          storageKey: input.storageKey ?? null,
          extractionId: input.extractionId ?? null,
          notes: input.notes ?? null,
        })
        .returning()

      if (!invoice) return null

      if (lines.length) {
        await tx
          .insert(supplierInvoiceLines)
          .values(lines.map((line, index) => lineValues(invoice.id, line, index)))
      }
      if (allocations.length) {
        await tx
          .insert(supplierCostAllocations)
          .values(allocations.map((a) => allocationValues(invoice.id, a)))
      }

      if (runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildSupplierInvoiceCreateActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }

      return invoice
    })

    return created ? loadSupplierInvoice(db, created.id) : null
  },

  async update(
    db: PostgresJsDatabase,
    id: string,
    input: UpdateSupplierInvoiceInput,
    runtime: SupplierInvoiceServiceRuntime = {},
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() }
    for (const key of [
      "supplierId",
      "supplierInvoiceNo",
      "internalRef",
      "status",
      "currency",
      "baseCurrency",
      "fxRateSetId",
      "taxRegimeId",
      "issueDate",
      "dueDate",
      "storageKey",
      "extractionId",
      "notes",
    ] as const) {
      if (input[key] !== undefined) set[key] = input[key]
    }
    // If header totals are edited directly, keep balanceDue consistent.
    if (input.totalCents !== undefined) {
      set.totalCents = input.totalCents
      if (input.subtotalCents !== undefined) set.subtotalCents = input.subtotalCents
      if (input.taxCents !== undefined) set.taxCents = input.taxCents
    }

    const runUpdate = (writer: PostgresJsDatabase) =>
      writer.update(supplierInvoices).set(set).where(eq(supplierInvoices.id, id)).returning()

    if (runtime.actionLedgerContext) {
      const row = await db.transaction(async (tx) => {
        const [updated] = await runUpdate(tx)
        if (updated && input.totalCents !== undefined) {
          await tx
            .update(supplierInvoices)
            .set({ balanceDueCents: updated.totalCents - updated.paidCents })
            .where(eq(supplierInvoices.id, id))
        }
        if (updated) {
          await appendActionLedgerMutation(
            tx,
            buildSupplierInvoiceUpdateActionLedgerInput(
              runtime.actionLedgerContext as ActionLedgerRequestContextValues,
              { invoice: updated, changes: input },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }
        return updated ?? null
      })
      return row ? loadSupplierInvoice(db, id) : null
    }

    const [updated] = await runUpdate(db)
    if (updated && input.totalCents !== undefined) {
      await db
        .update(supplierInvoices)
        .set({ balanceDueCents: updated.totalCents - updated.paidCents })
        .where(eq(supplierInvoices.id, id))
    }
    return updated ? loadSupplierInvoice(db, id) : null
  },

  /**
   * Replace the invoice's lines and recompute header totals. Note: deleting a
   * line cascades to any per-line allocations bound to it (FK on delete cascade)
   * — re-set allocations after editing lines.
   */
  async setLines(
    db: PostgresJsDatabase,
    id: string,
    input: SetLinesInput,
    runtime: SupplierInvoiceServiceRuntime = {},
  ) {
    const totals = recomputeTotalsFromLines(input.lines)
    const updated = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, id))
        .limit(1)
      if (!invoice) return null

      await tx.delete(supplierInvoiceLines).where(eq(supplierInvoiceLines.supplierInvoiceId, id))
      if (input.lines.length) {
        await tx
          .insert(supplierInvoiceLines)
          .values(input.lines.map((line, index) => lineValues(id, line, index)))
      }
      const [next] = await tx
        .update(supplierInvoices)
        .set({
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          balanceDueCents: totals.totalCents - invoice.paidCents,
          updatedAt: new Date(),
        })
        .where(eq(supplierInvoices.id, id))
        .returning()

      if (next && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildSupplierInvoiceUpdateActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice: next, changes: { lines: input.lines.length } },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }
      return next ?? null
    })
    return updated ? loadSupplierInvoice(db, id) : null
  },

  /**
   * Replace the invoice's cost allocations after validating the §6.1 invariants
   * against the current lines + invoice total.
   */
  async setAllocations(
    db: PostgresJsDatabase,
    id: string,
    input: SetAllocationsInput,
    runtime: SupplierInvoiceServiceRuntime = {},
  ) {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, id))
        .limit(1)
      if (!invoice) return { invoice: null as null }

      const lines = await tx
        .select({
          id: supplierInvoiceLines.id,
          totalAmountCents: supplierInvoiceLines.totalAmountCents,
        })
        .from(supplierInvoiceLines)
        .where(eq(supplierInvoiceLines.supplierInvoiceId, id))

      const check = validateAllocations({
        invoiceTotalCents: invoice.totalCents,
        lines,
        allocations: input.allocations,
      })
      if (!check.ok) throw new SupplierInvoiceServiceError(check.code, check.message)

      await tx
        .delete(supplierCostAllocations)
        .where(eq(supplierCostAllocations.supplierInvoiceId, id))
      if (input.allocations.length) {
        await tx
          .insert(supplierCostAllocations)
          .values(input.allocations.map((a) => allocationValues(id, a)))
      }

      if (runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildSupplierInvoiceAllocationsActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice, allocationCount: input.allocations.length },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }
      return { invoice }
    })
    return result.invoice ? loadSupplierInvoice(db, id) : null
  },

  /** Soft-delete: keeps the audit trail; excluded from list + uniqueness. */
  async softDelete(
    db: PostgresJsDatabase,
    id: string,
    runtime: SupplierInvoiceServiceRuntime = {},
  ) {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, id))
        .limit(1)
      if (!existing) return null

      await tx
        .update(supplierInvoices)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(supplierInvoices.id, id))

      if (runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildSupplierInvoiceDeleteActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }
      return { id: existing.id }
    })
    return result
  },
}
