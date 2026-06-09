import type { PaymentCompletedEvent } from "@voyantjs/finance"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import {
  type CancelTripComponentsDeps,
  type PriceTripDeps,
  type ReserveTripDeps,
  type StartCheckoutDeps,
  type TravelComposerRoutesOptions,
  travelComposerService,
} from "@voyantjs/travel-composer"
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
          await travelComposerService.completeTripCheckout(db, {
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
        })
      } catch (err) {
        console.error("[travel-composer] payment completion failed", err)
      }
    })
  },
}

function createPriceTripDeps(c: Context): PriceTripDeps {
  return {
    quoteCatalogComponent: (input) => quoteCatalogComponent(c, input),
  }
}

export function createReserveTripDeps(c: Context): ReserveTripDeps {
  return {
    quoteCatalogComponentBeforeReserve: (input) => quoteCatalogComponent(c, input),
    validateNonCatalogComponentBeforeReserve: (input) =>
      validateNonCatalogComponentBeforeReserve(c, input),
    reserveCatalogComponent: (input) => reserveCatalogComponent(c, input),
    reserveNonCatalogComponent: (input) => reserveNonCatalogComponent(c, input),
    releaseCatalogComponent: (input) => releaseReservedComponent(c, input),
  }
}

export function createStartCheckoutDeps(c: Context): StartCheckoutDeps {
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
