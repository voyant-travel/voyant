import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "@voyant-travel/catalog-node/standard-node/booking-engine-runtime"
import { applyOperatorTaxToQuoteResult } from "@voyant-travel/catalog-node/standard-node/booking-runtime"
import { createCatalogPromotionEvaluator } from "@voyant-travel/commerce"
import type {
  CatalogCheckoutStartResult,
  CheckoutStartInput,
} from "@voyant-travel/commerce/checkout"
import { CatalogCheckoutStartError, startCatalogCheckout } from "@voyant-travel/commerce/checkout"
import type { EventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { createDemoFlightAdapter } from "@voyant-travel/plugin-flights-demo"
import type {
  CancelTripComponentsDeps,
  ComponentCheckoutInput,
  ComponentCheckoutResult,
  ReserveTripDeps,
  StartCheckoutDeps,
} from "@voyant-travel/trips"
import { createCatalogComponentAdapter } from "@voyant-travel/trips/catalog-component"
import { createVoyantFxQuoter, type TripCheckoutDeps } from "@voyant-travel/trips/checkout"
import { createFlightComponentAdapter } from "@voyant-travel/trips/flight-component"
import {
  catalogCheckoutResultToComponentResult,
  createTripsRouteRuntime,
} from "@voyant-travel/trips/route-runtime"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { resolveVoyantDataApiKey } from "../../lib/voyant-cloud"
import { cardPaymentStarter } from "./card-payment"
import { createOperatorCheckoutStartOptions } from "./catalog-checkout-options"

const tripsRouteRuntime = createTripsRouteRuntime({
  createCatalogAdapter(c) {
    const db = getDb(c)
    return createCatalogComponentAdapter({
      db,
      registry: getBookingEngineRegistryFromContext(c),
      ownedHandlers: getOwnedBookingHandlerRegistryFromContext(c),
      evaluatePromotions: createCatalogPromotionEvaluator(db),
      transformQuoteResult: (result, entityModule, entityId, sourceKind) =>
        applyOperatorTaxToQuoteResult(db, result, entityModule, entityId, sourceKind),
      adapterContext: (connectionId) => ({
        connection_id: connectionId ?? "engine",
        correlation_id: c.req.header("x-request-id") ?? crypto.randomUUID(),
      }),
      startCheckout: (input) => startComponentCheckout(c, input),
    })
  },
  createFlightAdapter(c) {
    const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
    if (!baseUrl) {
      throw new Error("FLIGHTS_DEMO_API_URL is required for the demo flight provider")
    }
    return createFlightComponentAdapter({
      adapter: createDemoFlightAdapter({ baseUrl }),
      adapterContext: {
        connectionId: "demo",
        correlationId: c.req.header("x-request-id") ?? undefined,
      },
    })
  },
  createCheckoutDeps,
})

export const createOperatorTripsRoutesOptions = tripsRouteRuntime.createRoutesOptions

export function createReserveTripDeps(c: Context): ReserveTripDeps {
  return tripsRouteRuntime.createReserveDeps(c)
}

export function createStartCheckoutDeps(c: Context): StartCheckoutDeps {
  return tripsRouteRuntime.createStartCheckoutDeps(c)
}

export function createCancelTripComponentsDeps(c: Context): CancelTripComponentsDeps {
  return tripsRouteRuntime.createCancelDeps(c)
}

function createCheckoutDeps(c: Context): TripCheckoutDeps {
  const env = c.env as AppBindings
  const apiKey = resolveVoyantDataApiKey(env)
  return {
    db: getDb(c),
    quoteFx: apiKey
      ? createVoyantFxQuoter({ apiKey, baseUrl: env.VOYANT_CLOUD_API_URL })
      : async () => {
          throw new Error("trip_checkout_fx_requires_voyant_data_api_key")
        },
    resolveCheckoutBaseUrl: () =>
      env.PUBLIC_CHECKOUT_BASE_URL?.trim() ||
      env.DASH_BASE_URL?.trim() ||
      env.APP_URL?.trim().replace(/\/api\/?$/, "") ||
      null,
    startProviderPayment: async ({ paymentSessionId, billing, description }) => {
      await cardPaymentStarter(c, {
        db: getDb(c) as PostgresJsDatabase,
        sessionId: paymentSessionId,
        billing,
        description,
      })
    },
  }
}

async function startComponentCheckout(
  c: Context,
  input: ComponentCheckoutInput,
): Promise<ComponentCheckoutResult> {
  const bookingId = required(input.component.bookingId, "component.bookingId")
  const checkoutInput: CheckoutStartInput = {
    ...(input.request as Partial<CheckoutStartInput>),
    bookingId,
    paymentIntent: input.intent,
  }
  try {
    const result: CatalogCheckoutStartResult = await startCatalogCheckout(
      {
        db: getDb(c) as PostgresJsDatabase,
        env: c.env as AppBindings & Record<string, string | undefined>,
        eventBus: getEventBus(c),
        resolveRuntime: (key) => getContainer(c)?.resolve(key),
        requestMeta: {
          clientIp:
            c.req.header("cf-connecting-ip") ??
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
            c.req.header("x-real-ip") ??
            "",
          userAgent: c.req.header("user-agent") ?? "",
        },
        options: createOperatorCheckoutStartOptions(c),
      },
      checkoutInput,
    )
    return catalogCheckoutResultToComponentResult(result)
  } catch (error) {
    if (error instanceof CatalogCheckoutStartError) throw new Error(error.code)
    throw error
  }
}

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

function getEventBus(c: Context): EventBus | undefined {
  return (c.var as { eventBus?: EventBus }).eventBus
}

function getContainer(c: Context): { resolve(key: string): unknown } | undefined {
  return (c.var as { container?: { resolve(key: string): unknown } }).container
}

function required(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`)
  return value
}
