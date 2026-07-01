import type {
  CreateInvoiceLineItemInput,
  FinanceServiceRuntime,
  PostgresJsDatabase,
  UpdateInvoiceLineItemInput,
} from "./service-shared.js"
import {
  appendActionLedgerMutation,
  asc,
  buildInvoiceLineItemCreateActionLedgerInput,
  buildInvoiceLineItemDeleteActionLedgerInput,
  buildInvoiceLineItemUpdateActionLedgerInput,
  eq,
  InvoiceValidationError,
  invoiceLineItems,
  invoices,
} from "./service-shared.js"

function assertLineItemTotalMatchesUnitAmount(
  data: Pick<CreateInvoiceLineItemInput, "quantity" | "unitPriceCents" | "totalCents">,
) {
  const expectedTotalCents = data.quantity * data.unitPriceCents
  if (data.totalCents === expectedTotalCents) return

  throw new InvoiceValidationError(
    "Invoice line item total must equal quantity multiplied by unit price",
    {
      quantity: data.quantity,
      unitPriceCents: data.unitPriceCents,
      totalCents: data.totalCents,
      expectedTotalCents,
    },
    { status: 400, code: "invoice_line_total_mismatch" },
  )
}

function assertLineItemPatchTotalMatchesUnitAmount(
  existing: typeof invoiceLineItems.$inferSelect,
  data: UpdateInvoiceLineItemInput,
) {
  const quantity = data.quantity ?? existing.quantity
  const unitPriceCents = data.unitPriceCents ?? existing.unitPriceCents
  const totalCents = data.totalCents ?? existing.totalCents
  assertLineItemTotalMatchesUnitAmount({ quantity, unitPriceCents, totalCents })
}

export const financeInvoiceLineItemService = {
  listInvoiceLineItems(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceLineItems.sortOrder))
  },

  async createInvoiceLineItem(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceLineItemInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    assertLineItemTotalMatchesUnitAmount(data)

    const createLineItem = async (writer: PostgresJsDatabase) => {
      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)

      if (!invoice) {
        return null
      }

      const [row] = await writer
        .insert(invoiceLineItems)
        .values({ ...data, invoiceId })
        .returning()

      return row ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const created = await createLineItem(tx)

        if (created) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemCreateActionLedgerInput(actionLedgerContext, created, {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            }),
          )
        }

        return created
      })

      return result?.lineItem ?? null
    }

    return (await createLineItem(db))?.lineItem ?? null
  },

  async updateInvoiceLineItem(
    db: PostgresJsDatabase,
    lineId: string,
    data: UpdateInvoiceLineItemInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateLineItem = async (writer: PostgresJsDatabase) => {
      const [existing] = await writer
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.id, lineId))
        .limit(1)

      if (!existing) {
        return null
      }

      assertLineItemPatchTotalMatchesUnitAmount(existing, data)

      const [row] = await writer
        .update(invoiceLineItems)
        .set(data)
        .where(eq(invoiceLineItems.id, lineId))
        .returning()

      if (!row) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1)

      return invoice ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const updated = await updateLineItem(tx)

        if (updated) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemUpdateActionLedgerInput(
              actionLedgerContext,
              { ...updated, changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return result?.lineItem ?? null
    }

    return (await updateLineItem(db))?.lineItem ?? null
  },

  async deleteInvoiceLineItem(
    db: PostgresJsDatabase,
    lineId: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const deleteLineItem = async (writer: PostgresJsDatabase) => {
      const [row] = await writer
        .delete(invoiceLineItems)
        .where(eq(invoiceLineItems.id, lineId))
        .returning()

      if (!row) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1)

      return invoice ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const deleted = await deleteLineItem(tx)

        if (deleted) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemDeleteActionLedgerInput(actionLedgerContext, deleted, {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            }),
          )
        }

        return deleted
      })

      return result?.lineItem ?? null
    }

    return (await deleteLineItem(db))?.lineItem ?? null
  },
}
