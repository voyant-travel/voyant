import type {
  CreateSupplierPaymentInput,
  FinanceServiceRuntime,
  PostgresJsDatabase,
  SupplierPaymentListQuery,
  UpdateSupplierPaymentInput,
} from "./service-shared.js"
import {
  and,
  appendActionLedgerMutation,
  asc,
  bookings,
  buildSupplierPaymentCreateActionLedgerInput,
  buildSupplierPaymentUpdateActionLedgerInput,
  desc,
  eq,
  gte,
  lte,
  recomputeSupplierInvoiceBalance,
  resolveFxMoneyBaseAmount,
  resolveSupplierPaymentUpdateData,
  sql,
  supplierInvoices,
  supplierPayments,
  toRows,
} from "./service-shared.js"
import { SupplierInvoiceServiceError } from "./service-supplier-invoices.js"

type SupplierInvoiceSettlementInput = {
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  status?: string | null
}

function settlementAmountInInvoiceCurrency(
  payment: SupplierInvoiceSettlementInput,
  invoice: { currency: string },
): number {
  if (payment.status !== "completed") return 0
  if (payment.currency === invoice.currency) return payment.amountCents
  if (payment.baseCurrency === invoice.currency) return payment.baseAmountCents ?? 0
  return 0
}

async function assertSupplierPaymentDoesNotOverpay(
  db: PostgresJsDatabase,
  data: SupplierInvoiceSettlementInput & { supplierInvoiceId?: string | null },
  options: { excludePaymentId?: string | null } = {},
) {
  if (!data.supplierInvoiceId || data.status !== "completed") return

  const invoiceResult = await db.execute(sql`
    SELECT id, currency, total_cents AS "totalCents"
    FROM supplier_invoices
    WHERE id = ${data.supplierInvoiceId}
    FOR UPDATE
  `)
  const invoice =
    toRows<{ id: string; currency: string; totalCents: number }>(invoiceResult)[0] ?? null
  if (!invoice) return

  const conditions = [
    eq(supplierPayments.supplierInvoiceId, data.supplierInvoiceId),
    eq(supplierPayments.status, "completed"),
  ]
  if (options.excludePaymentId) {
    conditions.push(sql`${supplierPayments.id} <> ${options.excludePaymentId}`)
  }

  const [agg] = await db
    .select({
      paid: sql<number>`coalesce(sum(
        case
          when ${supplierPayments.currency} = ${invoice.currency} then ${supplierPayments.amountCents}
          when ${supplierPayments.baseCurrency} = ${invoice.currency} then coalesce(${supplierPayments.baseAmountCents}, 0)
          else 0
        end
      ), 0)::int`,
    })
    .from(supplierPayments)
    .where(and(...conditions))

  const existingPaid = agg?.paid ?? 0
  const paymentAmount = settlementAmountInInvoiceCurrency(data, invoice)
  if (existingPaid + paymentAmount > invoice.totalCents) {
    throw new SupplierInvoiceServiceError(
      "invalid_payable_state",
      `supplier invoice payment exceeds payable balance (${invoice.totalCents - existingPaid})`,
    )
  }
}

export const financeSupplierPaymentService = {
  async listSupplierPayments(db: PostgresJsDatabase, query: SupplierPaymentListQuery) {
    const conditions = []

    if (query.bookingId) {
      conditions.push(eq(supplierPayments.bookingId, query.bookingId))
    }

    if (query.supplierInvoiceId) {
      conditions.push(eq(supplierPayments.supplierInvoiceId, query.supplierInvoiceId))
    }

    if (query.supplierId) {
      conditions.push(eq(supplierPayments.supplierId, query.supplierId))
    }

    if (query.status) {
      conditions.push(eq(supplierPayments.status, query.status))
    }

    if (query.paymentMethod) {
      conditions.push(eq(supplierPayments.paymentMethod, query.paymentMethod))
    }

    if (query.currency) {
      conditions.push(eq(supplierPayments.currency, query.currency))
    }

    if (query.paymentDateFrom) {
      conditions.push(gte(supplierPayments.paymentDate, query.paymentDateFrom))
    }

    if (query.paymentDateTo) {
      conditions.push(lte(supplierPayments.paymentDate, query.paymentDateTo))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "amountCents":
          return supplierPayments.amountCents
        case "status":
          return supplierPayments.status
        case "paymentDate":
          return supplierPayments.paymentDate
        default:
          return supplierPayments.createdAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(supplierPayments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(supplierPayments.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(supplierPayments).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async createSupplierPayment(
    db: PostgresJsDatabase,
    data: CreateSupplierPaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    // Derive the reporting base currency from the booking when present, else
    // from the supplier invoice the payment settles (AP payments may have no
    // booking). See §5.4.
    let targetBaseCurrency: string | null = null
    let fallbackFxRateSetId: string | null = null
    if (data.bookingId) {
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, data.bookingId))
        .limit(1)
      targetBaseCurrency = booking?.baseCurrency ?? null
      fallbackFxRateSetId = booking?.fxRateSetId ?? null
    } else if (data.supplierInvoiceId) {
      const [invoice] = await db
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, data.supplierInvoiceId))
        .limit(1)
      targetBaseCurrency = invoice?.baseCurrency ?? null
      fallbackFxRateSetId = invoice?.fxRateSetId ?? null
    }

    const paymentData = await resolveFxMoneyBaseAmount(db, data, {
      ...runtime,
      targetBaseCurrency,
      fallbackFxRateSetId,
      date: data.paymentDate,
    })
    const row = await db.transaction(async (tx) => {
      await assertSupplierPaymentDoesNotOverpay(tx, paymentData)

      const [created] = await tx
        .insert(supplierPayments)
        .values({ ...paymentData, paymentInstrumentId: paymentData.paymentInstrumentId ?? null })
        .returning()

      if (created && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildSupplierPaymentCreateActionLedgerInput(
            runtime.actionLedgerContext,
            { payment: created },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }
      // Keep the settled invoice's paid/balance/status in sync (§10).
      if (created?.supplierInvoiceId) {
        await recomputeSupplierInvoiceBalance(tx, created.supplierInvoiceId)
      }
      return created ?? null
    })

    return row
  },

  async updateSupplierPayment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSupplierPaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [existing] = await db
      .select()
      .from(supplierPayments)
      .where(eq(supplierPayments.id, id))
      .limit(1)
    if (!existing) return null

    const updateData = await resolveSupplierPaymentUpdateData(db, id, data, runtime)
    if (!updateData) return null
    const paymentAfterUpdate = {
      amountCents: updateData.amountCents ?? existing.amountCents,
      currency: updateData.currency ?? existing.currency,
      baseCurrency:
        updateData.baseCurrency !== undefined ? updateData.baseCurrency : existing.baseCurrency,
      baseAmountCents:
        updateData.baseAmountCents !== undefined
          ? updateData.baseAmountCents
          : existing.baseAmountCents,
      status: updateData.status ?? existing.status,
      supplierInvoiceId:
        updateData.supplierInvoiceId !== undefined
          ? updateData.supplierInvoiceId
          : existing.supplierInvoiceId,
    }

    const row = await db.transaction(async (tx) => {
      await assertSupplierPaymentDoesNotOverpay(tx, paymentAfterUpdate, { excludePaymentId: id })

      const [updated] = await tx
        .update(supplierPayments)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(supplierPayments.id, id))
        .returning()

      if (updated && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildSupplierPaymentUpdateActionLedgerInput(
            runtime.actionLedgerContext,
            { payment: updated, changes: updateData },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }

      // Recompute both the previously-linked and newly-linked invoices so a
      // re-pointed or status-changed payment leaves balances consistent (§10).
      const affected = new Set(
        [existing.supplierInvoiceId, updated?.supplierInvoiceId].filter((value): value is string =>
          Boolean(value),
        ),
      )
      for (const invoiceId of affected) {
        await recomputeSupplierInvoiceBalance(tx, invoiceId)
      }
      return updated ?? null
    })

    return row ?? null
  },
}
