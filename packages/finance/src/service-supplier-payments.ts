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
} from "./service-shared.js"

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

    const row = await db.transaction(async (tx) => {
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
