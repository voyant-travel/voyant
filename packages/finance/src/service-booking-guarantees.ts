import { financePaymentProcessingService } from "./service-payment-processing.js"
import type {
  CreateBookingGuaranteeInput,
  CreatePaymentSessionFromGuaranteeInput,
  FinanceServiceRuntime,
  PostgresJsDatabase,
  UpdateBookingGuaranteeInput,
} from "./service-shared.js"
import {
  and,
  appendActionLedgerMutation,
  bookingGuarantees,
  bookings,
  buildBookingGuaranteeCreateActionLedgerInput,
  buildBookingGuaranteeDeleteActionLedgerInput,
  buildBookingGuaranteeUpdateActionLedgerInput,
  desc,
  eq,
  ne,
  PaymentValidationError,
  toTimestamp,
} from "./service-shared.js"

export const financeBookingGuaranteeService = {
  listBookingGuarantees(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingGuarantees)
      .where(eq(bookingGuarantees.bookingId, bookingId))
      .orderBy(desc(bookingGuarantees.createdAt))
  },

  async createBookingGuarantee(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingGuaranteeInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createGuarantee = async (writer: PostgresJsDatabase) => {
      const [booking] = await writer
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const [row] = await writer
        .insert(bookingGuarantees)
        .values({
          bookingId,
          bookingPaymentScheduleId: data.bookingPaymentScheduleId ?? null,
          bookingItemId: data.bookingItemId ?? null,
          guaranteeType: data.guaranteeType,
          status: data.status,
          paymentInstrumentId: data.paymentInstrumentId ?? null,
          paymentAuthorizationId: data.paymentAuthorizationId ?? null,
          currency: data.currency ?? null,
          amountCents: data.amountCents ?? null,
          provider: data.provider ?? null,
          referenceNumber: data.referenceNumber ?? null,
          guaranteedAt: toTimestamp(data.guaranteedAt),
          expiresAt: toTimestamp(data.expiresAt),
          releasedAt: toTimestamp(data.releasedAt),
          notes: data.notes ?? null,
        })
        .returning()

      return row ?? null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const row = await createGuarantee(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            await buildBookingGuaranteeCreateActionLedgerInput(
              actionLedgerContext,
              { guarantee: row },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row
      })
    }

    return createGuarantee(db)
  },

  async createPaymentSessionFromBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: CreatePaymentSessionFromGuaranteeInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [guarantee] = await db
      .select()
      .from(bookingGuarantees)
      .where(eq(bookingGuarantees.id, guaranteeId))
      .limit(1)

    if (!guarantee) {
      return null
    }

    if (
      guarantee.status === "active" ||
      guarantee.status === "released" ||
      guarantee.status === "cancelled"
    ) {
      throw new Error(`Cannot create payment session for guarantee in status "${guarantee.status}"`)
    }

    const currency = guarantee.currency
    const amountCents = guarantee.amountCents
    if (!currency || amountCents === null || amountCents === undefined || amountCents <= 0) {
      throw new Error(
        "Booking guarantee must have currency and amount before creating a payment session",
      )
    }

    return financePaymentProcessingService.createPaymentSession(
      db,
      {
        targetType: "booking_guarantee",
        targetId: guarantee.id,
        bookingId: guarantee.bookingId,
        bookingGuaranteeId: guarantee.id,
        paymentInstrumentId: guarantee.paymentInstrumentId ?? null,
        paymentAuthorizationId: guarantee.paymentAuthorizationId ?? null,
        status: "pending",
        provider: data.provider ?? guarantee.provider ?? null,
        externalReference: data.externalReference ?? guarantee.referenceNumber ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        clientReference: data.clientReference ?? guarantee.id,
        currency,
        amountCents,
        paymentMethod: data.paymentMethod ?? null,
        payerPersonId: data.payerPersonId ?? null,
        payerOrganizationId: data.payerOrganizationId ?? null,
        payerEmail: data.payerEmail ?? null,
        payerName: data.payerName ?? null,
        returnUrl: data.returnUrl ?? null,
        cancelUrl: data.cancelUrl ?? null,
        callbackUrl: data.callbackUrl ?? null,
        expiresAt: data.expiresAt ?? null,
        notes: data.notes ?? guarantee.notes ?? null,
        providerPayload: data.providerPayload ?? null,
        metadata: data.metadata ?? {
          guaranteeType: guarantee.guaranteeType,
        },
      },
      runtime,
    )
  },

  async updateBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: UpdateBookingGuaranteeInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateGuarantee = (writer: PostgresJsDatabase) =>
      writer
        .update(bookingGuarantees)
        .set({
          ...data,
          guaranteedAt:
            data.guaranteedAt === undefined ? undefined : toTimestamp(data.guaranteedAt),
          expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
          releasedAt: data.releasedAt === undefined ? undefined : toTimestamp(data.releasedAt),
          updatedAt: new Date(),
        })
        .where(eq(bookingGuarantees.id, guaranteeId))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateGuarantee(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildBookingGuaranteeUpdateActionLedgerInput(
              actionLedgerContext,
              { guarantee: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateGuarantee(db)
    return row ?? null
  },

  async deleteBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    function assertCanDeleteGuarantee(guarantee: typeof bookingGuarantees.$inferSelect) {
      if (guarantee.status === "active") {
        throw new PaymentValidationError(
          "Active guarantees must be released, cancelled, failed, or expired before deletion",
          { field: "status", status: guarantee.status, guaranteeId: guarantee.id },
          { code: "active_guarantee_delete_forbidden" },
        )
      }
    }

    function assertDeleteSucceeded(row: { id: string } | undefined | null, guaranteeId: string) {
      if (!row) {
        throw new PaymentValidationError(
          "Active guarantees must be released, cancelled, failed, or expired before deletion",
          { field: "status", status: "active", guaranteeId },
          { code: "active_guarantee_delete_forbidden" },
        )
      }
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(bookingGuarantees)
          .where(eq(bookingGuarantees.id, guaranteeId))
          .limit(1)

        if (!existing) {
          return null
        }

        assertCanDeleteGuarantee(existing)

        const [deleted] = await tx
          .delete(bookingGuarantees)
          .where(and(eq(bookingGuarantees.id, guaranteeId), ne(bookingGuarantees.status, "active")))
          .returning({ id: bookingGuarantees.id })
        assertDeleteSucceeded(deleted, guaranteeId)
        await appendActionLedgerMutation(
          tx,
          buildBookingGuaranteeDeleteActionLedgerInput(
            actionLedgerContext,
            { guarantee: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

    const [existing] = await db
      .select()
      .from(bookingGuarantees)
      .where(eq(bookingGuarantees.id, guaranteeId))
      .limit(1)

    if (!existing) {
      return null
    }

    assertCanDeleteGuarantee(existing)

    const [row] = await db
      .delete(bookingGuarantees)
      .where(and(eq(bookingGuarantees.id, guaranteeId), ne(bookingGuarantees.status, "active")))
      .returning({ id: bookingGuarantees.id })

    assertDeleteSucceeded(row, guaranteeId)
    return row ?? null
  },
}
