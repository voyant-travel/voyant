import type { BookingCancelledEvent } from "@voyantjs/bookings"
import type { EventBus } from "@voyantjs/core"
import type { PaymentCompletedEvent } from "@voyantjs/finance"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import {
  type CancelTripComponentsDeps,
  type PriceTripDeps,
  type ReserveTripDeps,
  type StartCheckoutDeps,
  type TravelComposerRoutesOptions,
  type TripComponent,
  travelComposerService,
} from "@voyantjs/travel-composer"
import { tripComponents } from "@voyantjs/travel-composer/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { withDbFromEnv } from "./lib/db"
import {
  cancelComponent,
  previewComponentCancellation,
  quoteCatalogComponent,
  releaseReservedComponent,
  reserveCatalogComponent,
  startComponentCheckout,
} from "./travel-composer-catalog-runtime"
import {
  reserveNonCatalogComponent,
  validateNonCatalogComponentBeforeReserve,
} from "./travel-composer-flight-runtime"
import { startTripCheckout } from "./travel-composer-trip-checkout"

export function createOperatorTravelComposerRoutesOptions(): TravelComposerRoutesOptions {
  return {
    priceTripDeps: (c) => createPriceTripDeps(c),
    reserveTripDeps: (c) => createReserveTripDeps(c),
    startCheckoutDeps: (c) => createStartCheckoutDeps(c),
    cancelTripComponentsDeps: (c) => createCancelTripComponentsDeps(c),
  }
}

export const travelComposerPaymentBundle: HonoBundle = {
  name: "travel-composer-payment-completion",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings
    eventBus.subscribe<PaymentCompletedEvent>("payment.completed", async ({ data }) => {
      if (data.targetType !== "other" || !data.targetId?.startsWith("trip_")) return

      try {
        await withDbFromEnv(env, async (rawDb) => {
          const db = rawDb as PostgresJsDatabase
          await completeTripPaymentAndFanOut(db, eventBus, data)
        })
      } catch (err) {
        console.error("[travel-composer] payment completion failed", err)
      }
    })
    eventBus.subscribe<BookingCancelledEvent>("booking.cancelled", async ({ data }) => {
      try {
        await withDbFromEnv(env, async (rawDb) => {
          const db = rawDb as PostgresJsDatabase
          await cancelTripForCoreBookingCancellation(db, data)
        })
      } catch (err) {
        console.error("[travel-composer] booking cancellation cleanup failed", err)
      }
    })
  },
}

export async function completeTripPaymentAndFanOut(
  db: PostgresJsDatabase,
  eventBus: EventBus,
  data: PaymentCompletedEvent,
): Promise<void> {
  const result = await travelComposerService.completeTripCheckout(db, {
    envelopeId: data.targetId ?? undefined,
    paymentSessionId: data.paymentSessionId,
    payload: {
      amountCents: data.amountCents,
      currency: data.currency,
      provider: data.provider,
      targetType: data.targetType,
      targetId: data.targetId,
    },
  })
  if (!result) return

  await emitComponentBookingPaymentCompletions(eventBus, result.components, data)
}

export async function cancelTripForCoreBookingCancellation(
  db: PostgresJsDatabase,
  data: BookingCancelledEvent,
): Promise<void> {
  const components = (await db
    .select()
    .from(tripComponents)
    .where(eq(tripComponents.bookingId, data.bookingId))) as TripComponent[]
  if (components.length === 0) return

  for (const component of components) {
    const trip = await travelComposerService.getTrip(db, component.envelopeId)
    if (!trip) continue

    const isCoreBooking =
      coreBookingIdFromEnvelope(trip.envelope.constraints) === data.bookingId ||
      coreBookingIdFromComponent(component) === data.bookingId
    if (!isCoreBooking) {
      if (component.status !== "cancelled" && component.status !== "removed") {
        await travelComposerService.updateComponent(db, component.id, { status: "cancelled" })
      }
      continue
    }

    for (const item of trip.components) {
      if (item.status === "cancelled" || item.status === "removed") continue
      await travelComposerService.updateComponent(db, item.id, { status: "cancelled" })
    }
    await travelComposerService.updateTrip(db, trip.envelope.id, { status: "cancelled" })
  }
}

function coreBookingIdFromEnvelope(constraints: unknown): string | null {
  const value = asRecord(constraints)?.committedBookingId
  return typeof value === "string" && value.length > 0 ? value : null
}

function coreBookingIdFromComponent(component: TripComponent): string | null {
  const catalogBooking = asRecord(asRecord(component.metadata)?.catalogBooking)
  const value = catalogBooking?.committedBookingId
  return typeof value === "string" && value.length > 0 ? value : null
}

async function emitComponentBookingPaymentCompletions(
  eventBus: EventBus,
  components: TripComponent[],
  source: PaymentCompletedEvent,
): Promise<void> {
  const emitted = new Set<string>()
  for (const component of components) {
    if (!component.bookingId || emitted.has(component.bookingId)) continue
    if (component.status === "removed" || component.status === "cancelled") continue
    emitted.add(component.bookingId)
    await eventBus.emit(
      "payment.completed",
      {
        paymentSessionId: source.paymentSessionId,
        targetType: "booking",
        targetId: component.bookingId,
        bookingId: component.bookingId,
        orderId: component.orderId,
        invoiceId: null,
        bookingPaymentScheduleId: null,
        bookingGuaranteeId: null,
        amountCents: component.componentTotalAmountCents ?? source.amountCents,
        currency: component.componentCurrency ?? source.currency,
        provider: source.provider,
      } satisfies PaymentCompletedEvent,
      {
        category: "domain",
        source: "subscriber",
        causationId: source.paymentSessionId,
        tripEnvelopeId: source.targetId,
        tripComponentId: component.id,
      },
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function createPriceTripDeps(c: Context): PriceTripDeps {
  return {
    quoteCatalogComponent: (input) => quoteCatalogComponent(c, input),
  }
}

function createReserveTripDeps(c: Context): ReserveTripDeps {
  return {
    quoteCatalogComponentBeforeReserve: (input) => quoteCatalogComponent(c, input),
    validateNonCatalogComponentBeforeReserve: (input) =>
      validateNonCatalogComponentBeforeReserve(c, input),
    reserveCatalogComponent: (input) => reserveCatalogComponent(c, input),
    reserveNonCatalogComponent: (input) => reserveNonCatalogComponent(c, input),
    releaseCatalogComponent: (input) => releaseReservedComponent(c, input),
  }
}

function createStartCheckoutDeps(c: Context): StartCheckoutDeps {
  return {
    startTripCheckout: (input) => startTripCheckout(c, input),
    startComponentCheckout: (input) => startComponentCheckout(c, input),
  }
}

function createCancelTripComponentsDeps(c: Context): CancelTripComponentsDeps {
  return {
    previewComponentCancellation: (input) => previewComponentCancellation(input),
    cancelComponent: (input) => cancelComponent(c, input),
  }
}
