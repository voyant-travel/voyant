import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type CheckoutFinalization,
  type CheckoutFinalizationDelivery,
  checkoutFinalizationDeliveries,
  checkoutFinalizations,
} from "./schema-finalizations.js"

export interface CheckoutFinalizationIdentity {
  paymentSessionId: string
  bookingId: string
}

export type CheckoutFinalizationPatch = Partial<
  Pick<
    CheckoutFinalization,
    | "invoiceId"
    | "paymentId"
    | "confirmedAt"
    | "paymentRevision"
    | "contractId"
    | "contractAttachmentId"
    | "finalPaymentRenderVersion"
    | "finalPaymentRenderKey"
  >
>

export async function ensureCheckoutFinalization(
  db: PostgresJsDatabase,
  identity: CheckoutFinalizationIdentity,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(checkoutFinalizations)
      .values({
        bookingId: identity.bookingId,
        triggerPaymentSessionId: identity.paymentSessionId,
      })
      .onConflictDoNothing({ target: checkoutFinalizations.bookingId })
    await tx
      .insert(checkoutFinalizationDeliveries)
      .values(identity)
      .onConflictDoNothing({ target: checkoutFinalizationDeliveries.paymentSessionId })
  })

  const [row, delivery] = await Promise.all([
    getCheckoutFinalization(db, identity.bookingId),
    getCheckoutFinalizationDelivery(db, identity.paymentSessionId),
  ])
  if (!row || !delivery) {
    throw new Error("checkout-finalize: failed to persist finalization checkpoint")
  }
  assertDeliveryIdentity(delivery, identity)
}

export async function getCheckoutFinalization(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<CheckoutFinalization | null> {
  const [row] = await db
    .select()
    .from(checkoutFinalizations)
    .where(eq(checkoutFinalizations.bookingId, bookingId))
    .limit(1)
  return row ?? null
}

export async function getCheckoutFinalizationDelivery(
  db: PostgresJsDatabase,
  paymentSessionId: string,
): Promise<CheckoutFinalizationDelivery | null> {
  const [row] = await db
    .select()
    .from(checkoutFinalizationDeliveries)
    .where(eq(checkoutFinalizationDeliveries.paymentSessionId, paymentSessionId))
    .limit(1)
  return row ?? null
}

/**
 * Serialize one checkpointed side effect. The row lock is held in the same
 * transaction as the domain writes and checkpoint update, so overlapping
 * non-cancelling deliveries cannot both observe an incomplete step.
 */
export async function withCheckoutFinalizationLock<T>(
  db: PostgresJsDatabase,
  identity: CheckoutFinalizationIdentity,
  operation: (tx: PostgresJsDatabase, state: CheckoutFinalization) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx
      .insert(checkoutFinalizations)
      .values({
        bookingId: identity.bookingId,
        triggerPaymentSessionId: identity.paymentSessionId,
      })
      .onConflictDoNothing({ target: checkoutFinalizations.bookingId })
    await tx
      .insert(checkoutFinalizationDeliveries)
      .values(identity)
      .onConflictDoNothing({ target: checkoutFinalizationDeliveries.paymentSessionId })

    await tx.execute(
      sql`SELECT booking_id
          FROM ${checkoutFinalizations}
          WHERE ${checkoutFinalizations.bookingId} = ${identity.bookingId}
          FOR UPDATE`,
    )
    const [state] = await tx
      .select()
      .from(checkoutFinalizations)
      .where(eq(checkoutFinalizations.bookingId, identity.bookingId))
      .limit(1)
    if (!state) throw new Error("checkout-finalize: missing locked finalization checkpoint")
    const delivery = await getCheckoutFinalizationDelivery(
      tx as PostgresJsDatabase,
      identity.paymentSessionId,
    )
    if (!delivery) throw new Error("checkout-finalize: missing locked delivery checkpoint")
    assertDeliveryIdentity(delivery, identity)
    return operation(tx as PostgresJsDatabase, state)
  })
}

export async function updateCheckoutFinalization(
  db: PostgresJsDatabase,
  identity: CheckoutFinalizationIdentity,
  expectedRevision: number,
  patch: CheckoutFinalizationPatch,
): Promise<CheckoutFinalization> {
  const [updated] = await db
    .update(checkoutFinalizations)
    .set({
      ...patch,
      revision: expectedRevision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(checkoutFinalizations.bookingId, identity.bookingId),
        eq(checkoutFinalizations.revision, expectedRevision),
      ),
    )
    .returning()
  if (!updated) {
    throw new Error("checkout-finalize: finalization checkpoint fence was superseded")
  }
  return updated
}

export async function updateCheckoutFinalizationDelivery(
  db: PostgresJsDatabase,
  identity: CheckoutFinalizationIdentity,
  patch: Partial<Pick<CheckoutFinalizationDelivery, "paymentLinkedAt" | "completedAt">>,
): Promise<void> {
  const [updated] = await db
    .update(checkoutFinalizationDeliveries)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(checkoutFinalizationDeliveries.paymentSessionId, identity.paymentSessionId),
        eq(checkoutFinalizationDeliveries.bookingId, identity.bookingId),
      ),
    )
    .returning({ paymentSessionId: checkoutFinalizationDeliveries.paymentSessionId })
  if (!updated) throw new Error("checkout-finalize: missing delivery checkpoint")
}

function assertDeliveryIdentity(
  row: Pick<CheckoutFinalizationDelivery, "paymentSessionId" | "bookingId">,
  identity: CheckoutFinalizationIdentity,
): void {
  if (row.bookingId !== identity.bookingId) {
    throw new Error(
      `checkout-finalize: payment session ${identity.paymentSessionId} belongs to booking ${row.bookingId}`,
    )
  }
}
