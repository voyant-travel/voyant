import type {
  CreatePaymentAuthorizationInput,
  CreatePaymentCaptureInput,
  FinanceServiceRuntime,
  PaymentAuthorizationListQuery,
  PaymentCaptureListQuery,
  PostgresJsDatabase,
  UpdatePaymentAuthorizationInput,
  UpdatePaymentCaptureInput,
} from "./service-shared.js"
import {
  and,
  appendActionLedgerMutation,
  buildPaymentAuthorizationCreateActionLedgerInput,
  buildPaymentAuthorizationDeleteActionLedgerInput,
  buildPaymentAuthorizationUpdateActionLedgerInput,
  buildPaymentCaptureCreateActionLedgerInput,
  buildPaymentCaptureDeleteActionLedgerInput,
  buildPaymentCaptureUpdateActionLedgerInput,
  desc,
  eq,
  paginate,
  paymentAuthorizations,
  paymentCaptures,
  sql,
  toTimestamp,
} from "./service-shared.js"

type PaymentAuthorizationTargetColumns = {
  bookingId?: string
  invoiceId?: string
  bookingGuaranteeId?: string
  orderId?: string
}

function derivePaymentAuthorizationTargetColumns(
  data: CreatePaymentAuthorizationInput | UpdatePaymentAuthorizationInput,
): PaymentAuthorizationTargetColumns {
  const explicitTarget = "target" in data ? data.target : undefined
  if (!explicitTarget) return {}

  switch (explicitTarget.type) {
    case "booking":
      return { bookingId: explicitTarget.bookingId }
    case "invoice":
      return { invoiceId: explicitTarget.invoiceId }
    case "booking_guarantee":
      return { bookingGuaranteeId: explicitTarget.bookingGuaranteeId }
    case "legacy_order":
      return { orderId: explicitTarget.legacyOrderId }
    default:
      return {}
  }
}

export const financePaymentAuthorizationService = {
  async listPaymentAuthorizations(db: PostgresJsDatabase, query: PaymentAuthorizationListQuery) {
    const conditions = []
    if (query.bookingId) conditions.push(eq(paymentAuthorizations.bookingId, query.bookingId))
    if (query.legacyOrderId) conditions.push(eq(paymentAuthorizations.orderId, query.legacyOrderId))
    if (query.invoiceId) conditions.push(eq(paymentAuthorizations.invoiceId, query.invoiceId))
    if (query.bookingGuaranteeId)
      conditions.push(eq(paymentAuthorizations.bookingGuaranteeId, query.bookingGuaranteeId))
    if (query.paymentInstrumentId)
      conditions.push(eq(paymentAuthorizations.paymentInstrumentId, query.paymentInstrumentId))
    if (query.status) conditions.push(eq(paymentAuthorizations.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentAuthorizations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentAuthorizations.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentAuthorizations).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentAuthorizationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .limit(1)
    return row ?? null
  },

  async createPaymentAuthorization(
    db: PostgresJsDatabase,
    data: CreatePaymentAuthorizationInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const targetColumns = derivePaymentAuthorizationTargetColumns(data)
    const {
      legacyOrderId,
      target: _explicitTarget,
      provenance: _provenance,
      ...authorizationData
    } = data
    const resolvedLegacyOrderId = legacyOrderId ?? null
    const createAuthorization = (writer: PostgresJsDatabase) =>
      writer
        .insert(paymentAuthorizations)
        .values({
          ...authorizationData,
          ...targetColumns,
          orderId: targetColumns.orderId ?? resolvedLegacyOrderId,
          authorizedAt: toTimestamp(data.authorizedAt),
          expiresAt: toTimestamp(data.expiresAt),
          voidedAt: toTimestamp(data.voidedAt),
        })
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createAuthorization(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildPaymentAuthorizationCreateActionLedgerInput(
              actionLedgerContext,
              { authorization: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createAuthorization(db)
    return row ?? null
  },

  async updatePaymentAuthorization(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentAuthorizationInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const targetColumns = derivePaymentAuthorizationTargetColumns(data)
    const {
      legacyOrderId,
      target: _explicitTarget,
      provenance: _provenance,
      ...authorizationData
    } = data
    const resolvedLegacyOrderId = legacyOrderId
    const updateAuthorization = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentAuthorizations)
        .set({
          ...authorizationData,
          ...targetColumns,
          orderId:
            targetColumns.orderId ??
            (resolvedLegacyOrderId === undefined ? undefined : (resolvedLegacyOrderId ?? null)),
          authorizedAt:
            data.authorizedAt === undefined ? undefined : toTimestamp(data.authorizedAt),
          expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
          voidedAt: data.voidedAt === undefined ? undefined : toTimestamp(data.voidedAt),
          updatedAt: new Date(),
        })
        .where(eq(paymentAuthorizations.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateAuthorization(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentAuthorizationUpdateActionLedgerInput(
              actionLedgerContext,
              { authorization: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateAuthorization(db)
    return row ?? null
  },

  async deletePaymentAuthorization(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentAuthorizations)
          .where(eq(paymentAuthorizations.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentAuthorizations).where(eq(paymentAuthorizations.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentAuthorizationDeleteActionLedgerInput(
            actionLedgerContext,
            { authorization: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

    const [row] = await db
      .delete(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .returning({ id: paymentAuthorizations.id })
    return row ?? null
  },

  async listPaymentCaptures(db: PostgresJsDatabase, query: PaymentCaptureListQuery) {
    const conditions = []
    if (query.paymentAuthorizationId)
      conditions.push(eq(paymentCaptures.paymentAuthorizationId, query.paymentAuthorizationId))
    if (query.invoiceId) conditions.push(eq(paymentCaptures.invoiceId, query.invoiceId))
    if (query.status) conditions.push(eq(paymentCaptures.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentCaptures)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentCaptures.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentCaptures).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentCaptureById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(paymentCaptures).where(eq(paymentCaptures.id, id)).limit(1)
    return row ?? null
  },

  async createPaymentCapture(
    db: PostgresJsDatabase,
    data: CreatePaymentCaptureInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createCapture = (writer: PostgresJsDatabase) =>
      writer
        .insert(paymentCaptures)
        .values({
          ...data,
          capturedAt: toTimestamp(data.capturedAt),
          settledAt: toTimestamp(data.settledAt),
        })
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createCapture(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildPaymentCaptureCreateActionLedgerInput(
              actionLedgerContext,
              { capture: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createCapture(db)
    return row ?? null
  },

  async updatePaymentCapture(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentCaptureInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateCapture = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentCaptures)
        .set({
          ...data,
          capturedAt: data.capturedAt === undefined ? undefined : toTimestamp(data.capturedAt),
          settledAt: data.settledAt === undefined ? undefined : toTimestamp(data.settledAt),
          updatedAt: new Date(),
        })
        .where(eq(paymentCaptures.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateCapture(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentCaptureUpdateActionLedgerInput(
              actionLedgerContext,
              { capture: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateCapture(db)
    return row ?? null
  },

  async deletePaymentCapture(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentCaptures)
          .where(eq(paymentCaptures.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentCaptures).where(eq(paymentCaptures.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentCaptureDeleteActionLedgerInput(
            actionLedgerContext,
            { capture: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

    const [row] = await db
      .delete(paymentCaptures)
      .where(eq(paymentCaptures.id, id))
      .returning({ id: paymentCaptures.id })
    return row ?? null
  },
}
