import type {
  CreatePaymentInstrumentInput,
  FinanceServiceRuntime,
  PaymentInstrumentListQuery,
  PostgresJsDatabase,
  UpdatePaymentInstrumentInput,
} from "./service-shared.js"
import {
  and,
  appendActionLedgerMutation,
  buildPaymentInstrumentCreateActionLedgerInput,
  buildPaymentInstrumentDeleteActionLedgerInput,
  buildPaymentInstrumentUpdateActionLedgerInput,
  desc,
  eq,
  ilike,
  or,
  paginate,
  paymentInstruments,
  sql,
} from "./service-shared.js"

export const financePaymentInstrumentService = {
  async listPaymentInstruments(db: PostgresJsDatabase, query: PaymentInstrumentListQuery) {
    const conditions = []
    if (query.ownerType) conditions.push(eq(paymentInstruments.ownerType, query.ownerType))
    if (query.personId) conditions.push(eq(paymentInstruments.personId, query.personId))
    if (query.organizationId)
      conditions.push(eq(paymentInstruments.organizationId, query.organizationId))
    if (query.supplierId) conditions.push(eq(paymentInstruments.supplierId, query.supplierId))
    if (query.channelId) conditions.push(eq(paymentInstruments.channelId, query.channelId))
    if (query.status) conditions.push(eq(paymentInstruments.status, query.status))
    if (query.instrumentType)
      conditions.push(eq(paymentInstruments.instrumentType, query.instrumentType))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(ilike(paymentInstruments.label, term), ilike(paymentInstruments.provider, term)),
      )
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentInstruments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentInstruments.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(paymentInstruments).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentInstrumentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(paymentInstruments)
      .where(eq(paymentInstruments.id, id))
      .limit(1)
    return row ?? null
  },

  async createPaymentInstrument(
    db: PostgresJsDatabase,
    data: CreatePaymentInstrumentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createInstrument = (writer: PostgresJsDatabase) =>
      writer.insert(paymentInstruments).values(data).returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createInstrument(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentInstrumentCreateActionLedgerInput(
              actionLedgerContext,
              { instrument: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createInstrument(db)
    return row ?? null
  },

  async updatePaymentInstrument(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentInstrumentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateInstrument = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentInstruments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(paymentInstruments.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateInstrument(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentInstrumentUpdateActionLedgerInput(
              actionLedgerContext,
              { instrument: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateInstrument(db)
    return row ?? null
  },

  async deletePaymentInstrument(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentInstruments)
          .where(eq(paymentInstruments.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentInstruments).where(eq(paymentInstruments.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentInstrumentDeleteActionLedgerInput(
            actionLedgerContext,
            { instrument: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

    const [row] = await db
      .delete(paymentInstruments)
      .where(eq(paymentInstruments.id, id))
      .returning({ id: paymentInstruments.id })
    return row ?? null
  },
}
