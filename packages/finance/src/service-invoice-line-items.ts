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
  invoiceLineItems,
  invoices,
} from "./service-shared.js"

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
