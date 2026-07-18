import type {
  BookingPaymentSchedulePaidEvent,
  CompletePaymentSessionInput,
  FinanceServiceRuntime,
  InvoicePaymentRecordedEvent,
  InvoiceSettledEvent,
  PostgresJsDatabase,
} from "./service-shared.js"
import {
  and,
  appendActionLedgerMutation,
  assertBookingPaymentScheduleHasPaymentCoverage,
  bookingGuarantees,
  bookingPaymentSchedules,
  buildBookingPaymentSchedulePaidEvent,
  buildPaymentCompletedEvent,
  buildPaymentSessionCompletionActionLedgerInput,
  eq,
  invoices,
  ne,
  PaymentValidationError,
  paymentAuthorizations,
  paymentCaptures,
  paymentSessions,
  payments,
  resolveInvoiceForPaymentSession,
  settleCoveredBookingPaymentSchedules,
  sql,
  toTimestamp,
} from "./service-shared.js"

export const financePaymentSessionCompletionService = {
  async completePaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: CompletePaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, id))
      .limit(1)

    if (!session) {
      return null
    }

    const shouldEmitPaymentCompleted = data.status === "paid" && session.status !== "paid"

    const txResult = await db.transaction(async (tx) => {
      let authorizationId = session.paymentAuthorizationId
      let captureId = session.paymentCaptureId
      let paymentId = session.paymentId
      const invoiceForPayment =
        data.status === "paid" && !paymentId
          ? await resolveInvoiceForPaymentSession(tx, session)
          : null

      if (
        data.status === "paid" &&
        session.bookingPaymentScheduleId &&
        !paymentId &&
        !invoiceForPayment
      ) {
        throw new PaymentValidationError(
          "Cannot complete a booking payment schedule session without an outstanding booking invoice",
          {
            paymentSessionId: session.id,
            bookingPaymentScheduleId: session.bookingPaymentScheduleId,
          },
        )
      }

      // Settlement payload to emit after the tx commits, so subscribers see
      // a consistent post-update view. Stays null when this call doesn't
      // result in a new payment being applied to an invoice.
      let settlementForEmit: InvoiceSettledEvent | null = null
      let recordedPaymentForEmit: InvoicePaymentRecordedEvent | null = null
      let bookingSchedulePaidForEmit: BookingPaymentSchedulePaidEvent | null = null

      if (!authorizationId) {
        const [authorization] = await tx
          .insert(paymentAuthorizations)
          .values({
            bookingId: session.bookingId ?? null,
            orderId: session.orderId ?? null,
            invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? null,
            bookingGuaranteeId: session.bookingGuaranteeId ?? null,
            paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? null,
            status: data.status === "paid" ? "captured" : "authorized",
            captureMode: data.captureMode,
            currency: session.currency,
            amountCents: session.amountCents,
            provider: session.provider ?? null,
            externalAuthorizationId:
              data.externalAuthorizationId ??
              data.providerPaymentId ??
              session.providerPaymentId ??
              null,
            approvalCode: data.approvalCode ?? null,
            authorizedAt: toTimestamp(data.authorizedAt) ?? new Date(),
            expiresAt: toTimestamp(data.expiresAt),
            notes: data.notes ?? session.notes ?? null,
          })
          .returning({ id: paymentAuthorizations.id })

        authorizationId = authorization?.id ?? null
      } else if (data.status === "paid") {
        await tx
          .update(paymentAuthorizations)
          .set({
            status: "captured",
            paymentInstrumentId:
              data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
            externalAuthorizationId:
              data.externalAuthorizationId === undefined
                ? undefined
                : (data.externalAuthorizationId ?? null),
            approvalCode: data.approvalCode ?? undefined,
            authorizedAt:
              data.authorizedAt === undefined ? undefined : toTimestamp(data.authorizedAt),
            expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
            updatedAt: new Date(),
          })
          .where(eq(paymentAuthorizations.id, authorizationId))
      }

      if (data.status === "paid" && !captureId) {
        const [capture] = await tx
          .insert(paymentCaptures)
          .values({
            paymentAuthorizationId: authorizationId,
            invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? null,
            status: "completed",
            currency: session.currency,
            amountCents: session.amountCents,
            provider: session.provider ?? null,
            externalCaptureId:
              data.externalCaptureId ?? data.providerPaymentId ?? session.providerPaymentId ?? null,
            capturedAt: toTimestamp(data.capturedAt) ?? new Date(),
            settledAt: toTimestamp(data.settledAt),
            notes: data.notes ?? session.notes ?? null,
          })
          .returning({ id: paymentCaptures.id })

        captureId = capture?.id ?? null
      }

      if (data.status === "paid" && invoiceForPayment && !paymentId) {
        const [payment] = await tx
          .insert(payments)
          .values({
            invoiceId: invoiceForPayment.id,
            amountCents: session.amountCents,
            currency: session.currency,
            paymentMethod: data.paymentMethod ?? session.paymentMethod ?? "other",
            paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? null,
            paymentAuthorizationId: authorizationId,
            paymentCaptureId: captureId,
            status: "completed",
            referenceNumber:
              data.referenceNumber ?? data.externalReference ?? session.externalReference ?? null,
            paymentDate: (data.paymentDate ? new Date(data.paymentDate) : new Date())
              .toISOString()
              .slice(0, 10),
            notes: data.notes ?? session.notes ?? null,
          })
          .returning()

        paymentId = payment?.id ?? null

        const [sumResult] = await tx
          .select({ total: sql<number>`coalesce(sum(amount_cents), 0)::int` })
          .from(payments)
          .where(
            and(eq(payments.invoiceId, invoiceForPayment.id), eq(payments.status, "completed")),
          )

        const paidCents = sumResult?.total ?? 0
        const balanceDueCents = Math.max(0, invoiceForPayment.totalCents - paidCents)

        await tx
          .update(invoices)
          .set({
            paidCents,
            balanceDueCents,
            status:
              paidCents >= invoiceForPayment.totalCents
                ? "paid"
                : paidCents > 0
                  ? "partially_paid"
                  : invoiceForPayment.status,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceForPayment.id))

        if (payment) {
          settlementForEmit = {
            invoiceId: invoiceForPayment.id,
            paymentId: payment.id,
            provider: session.provider ?? "internal",
            newlyAppliedAmountCents: session.amountCents,
            paidCents,
            balanceDueCents,
          }
          recordedPaymentForEmit = {
            invoiceId: invoiceForPayment.id,
            invoiceNumber: invoiceForPayment.invoiceNumber,
            invoiceType: invoiceForPayment.invoiceType,
            bookingId: invoiceForPayment.bookingId,
            invoiceCurrency: invoiceForPayment.currency,
            invoiceTotalCents: invoiceForPayment.totalCents,
            invoicePaidCents: paidCents,
            invoiceBalanceDueCents: balanceDueCents,
            paymentId: payment.id,
            amountCents: payment.amountCents,
            currency: payment.currency,
            baseCurrency: payment.baseCurrency ?? null,
            baseAmountCents: payment.baseAmountCents ?? null,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            referenceNumber: payment.referenceNumber ?? null,
            paymentDate: payment.paymentDate,
            occurredAt: new Date().toISOString(),
          }
        }
      }

      if (session.bookingGuaranteeId && authorizationId) {
        await tx
          .update(bookingGuarantees)
          .set({
            paymentAuthorizationId: authorizationId,
            paymentInstrumentId:
              data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
            status: "active",
            guaranteedAt: toTimestamp(data.authorizedAt) ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookingGuarantees.id, session.bookingGuaranteeId))
      }

      const [updated] = await tx
        .update(paymentSessions)
        .set({
          status: data.status,
          paymentMethod: data.paymentMethod ?? session.paymentMethod ?? undefined,
          paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
          paymentAuthorizationId: authorizationId,
          paymentCaptureId: captureId,
          paymentId,
          invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? undefined,
          providerSessionId: data.providerSessionId ?? session.providerSessionId ?? undefined,
          providerPaymentId: data.providerPaymentId ?? session.providerPaymentId ?? undefined,
          externalReference: data.externalReference ?? session.externalReference ?? undefined,
          providerPayload: data.providerPayload ?? undefined,
          metadata: data.metadata ?? undefined,
          notes: data.notes ?? session.notes ?? undefined,
          redirectUrl: data.status === "paid" ? null : session.redirectUrl,
          failureCode: null,
          failureMessage: null,
          expiresAt: data.expiresAt === undefined ? session.expiresAt : toTimestamp(data.expiresAt),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentSessions.id, id))
        .returning()

      if (updated && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildPaymentSessionCompletionActionLedgerInput(
            runtime.actionLedgerContext,
            {
              session: updated,
              status: data.status,
              paymentId,
            },
            {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            },
          ),
        )
      }

      if (data.status === "paid" && session.bookingPaymentScheduleId) {
        const [schedule] = await tx
          .select()
          .from(bookingPaymentSchedules)
          .where(eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId))
          .limit(1)

        if (schedule) {
          await assertBookingPaymentScheduleHasPaymentCoverage(tx, schedule)

          const [paidSchedule] = await tx
            .update(bookingPaymentSchedules)
            .set({ status: "paid", updatedAt: new Date() })
            .where(
              and(
                eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId),
                ne(bookingPaymentSchedules.status, "paid"),
              ),
            )
            .returning()

          if (paidSchedule && updated) {
            bookingSchedulePaidForEmit = buildBookingPaymentSchedulePaidEvent(
              paidSchedule,
              updated,
              paymentId,
            )
          }
        }
      }

      return {
        updated: updated ?? null,
        settlement: settlementForEmit,
        recordedPayment: recordedPaymentForEmit,
        bookingSchedulePaid: bookingSchedulePaidForEmit,
      }
    })

    if (txResult.recordedPayment) {
      if (txResult.recordedPayment.bookingId) {
        await settleCoveredBookingPaymentSchedules(db, txResult.recordedPayment.bookingId)
      }
      await runtime.eventBus?.emit("invoice.payment.recorded", txResult.recordedPayment, {
        category: "domain",
        source: "service",
      })
    }

    if (txResult.settlement) {
      await runtime.eventBus?.emit("invoice.settled", txResult.settlement, {
        category: "domain",
        source: "service",
      })
    }

    if (txResult.bookingSchedulePaid) {
      await runtime.eventBus?.emit("booking_payment_schedule.paid", txResult.bookingSchedulePaid, {
        category: "domain",
        source: "service",
      })
    }

    // Emit a generic `payment.completed` so cross-vertical subscribers
    // can react without having to know the specific provider chain.
    // Some aggregate flows, such as composed trips, intentionally use a
    // generic target instead of booking/order/invoice columns; those still
    // need the completion event keyed by targetType/targetId.
    if (shouldEmitPaymentCompleted && txResult.updated) {
      await runtime.eventBus?.emit(
        "payment.completed",
        buildPaymentCompletedEvent(txResult.updated),
        {
          category: "domain",
          source: "service",
        },
      )
    }

    return txResult.updated
  },
}
