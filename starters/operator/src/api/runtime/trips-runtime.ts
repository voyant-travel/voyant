import { submitBookingReservationPlan } from "@voyant-travel/bookings/reservation-plans"
import type {
  CancelTripComponentsDeps,
  PriceTripDeps,
  ReserveTripDeps,
  StartCheckoutDeps,
  TripsRoutesOptions,
} from "@voyant-travel/trips"
import type { Context } from "hono"
import {
  cancelComponent as cancelCatalogComponent,
  previewComponentCancellation as previewCatalogComponentCancellation,
  quoteCatalogComponent,
  releaseReservedComponent,
  reserveCatalogComponent,
  startComponentCheckout,
} from "./trips-catalog-runtime"
import { startTripCheckout } from "./trips-checkout-runtime"
import {
  cancelFlightComponent,
  previewFlightComponentCancellation,
  reserveNonCatalogComponent,
  validateNonCatalogComponentBeforeReserve,
} from "./trips-flight-runtime"

export function createOperatorTripsRoutesOptions(): TripsRoutesOptions {
  return {
    priceTripDeps: (c) => createPriceTripDeps(c),
    reserveTripDeps: (c) => createReserveTripDeps(c),
    startCheckoutDeps: (c) => createStartCheckoutDeps(c),
    cancelTripComponentsDeps: (c) => createCancelTripComponentsDeps(c),
  }
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
    submitReservationPlan: async (input) => {
      const submitted = await submitBookingReservationPlan(
        {
          reservationPlanId: input.reservationPlan.id,
          idempotencyKey: input.idempotencyKey,
          origin: {
            source: "trips",
            tripEnvelopeId: input.envelope.id,
          },
          envelope: input.envelope,
          lines: input.components.map((component) => ({
            planLineId: component.componentId,
            componentId: component.componentId,
            kind: component.reservationKind,
            line: component.component,
          })),
        },
        {
          reserveCatalogBackedLine: ({ plan, line }) =>
            reserveCatalogComponent(c, {
              envelope: plan.envelope,
              component: line.line,
              reservationPlanId: plan.reservationPlanId,
            }),
          reserveNonCatalogLine: ({ plan, line }) =>
            reserveNonCatalogComponent(c, {
              envelope: plan.envelope,
              component: line.line,
              reservationPlanId: plan.reservationPlanId,
            }),
          releaseReservedLine: ({ line, result }) => {
            if (line.kind !== "catalog_backed") {
              return Promise.resolve({ released: false, reason: "release_not_configured" })
            }
            return releaseReservedComponent(c, {
              component: line.line,
              reserveResult: result,
            })
          },
        },
      )

      return {
        reservationPlanId: submitted.reservationPlanId,
        status: submitted.status,
        reserved: submitted.reserved.map((item) => ({
          componentId: item.componentId,
          status: item.status,
          result: item.result,
        })),
        failures: submitted.failures,
        compensations: submitted.compensations,
        warnings: submitted.warnings,
      }
    },
  }
}

export function createStartCheckoutDeps(c: Context): StartCheckoutDeps {
  return {
    startTripCheckout: (input) => startTripCheckout(c, input),
    startComponentCheckout: (input) => startComponentCheckout(c, input),
  }
}

export function createCancelTripComponentsDeps(c: Context): CancelTripComponentsDeps {
  return {
    previewComponentCancellation: (input) =>
      input.component.kind === "flight_placeholder"
        ? previewFlightComponentCancellation(input)
        : previewCatalogComponentCancellation(input),
    cancelComponent: (input) =>
      input.component.kind === "flight_placeholder"
        ? cancelFlightComponent(c, input)
        : cancelCatalogComponent(c, input),
  }
}
