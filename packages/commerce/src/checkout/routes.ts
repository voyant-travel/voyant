/**
 * Storefront checkout route module, owned by `@voyant-travel/commerce`.
 *
 * POST /checkout/start parses the BookingJourney checkout request and
 * delegates to the checkout-start service. A deployment composes this and
 * supplies the `CheckoutStartOptions` (injected tax-settings + owned-product
 * name + bank-transfer instruction readers) the service needs.
 *
 * Mount the returned app at `/v1/public/catalog` (relative paths).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI storefront backfill
 * (voyant#2114 — commerce checkout sub-batch). The request body reuses the
 * existing `checkoutStartSchema`; the success response documents the
 * `CatalogCheckoutStartResult` discriminated union. The typed
 * `CatalogCheckoutStartError` status union (404/409/422/500/502) is inlined per the
 * single leg. The factory returns an `OpenAPIHono` so the build-time
 * `mergeLazyOpenApiPaths` replay can read its `.openapi()` registry (a plain
 * `Hono` carries no registry and would be skipped).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { EventBus } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { openApiValidationHook, stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { rebuildBookingItemTaxLines } from "./materialization-tax.js"
import type { CheckoutModuleOptions, CheckoutStartOptions } from "./options.js"
import { bookingMaintenanceRuntimePort, CATALOG_CHECKOUT_API_RUNTIME_KEY } from "./runtime-ports.js"
import {
  CatalogCheckoutStartError,
  type CheckoutStartRequestMeta,
  checkoutStartSchema,
  startCatalogCheckout,
} from "./start-service.js"

type CheckoutEnv = {
  Bindings: Record<string, string | undefined>
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
    container?: { resolve(key: string): unknown }
  }
}

const errorResponseSchema = z.object({ error: z.string() })

const bankTransferInstructionsSchema = z.object({
  beneficiary: z.string(),
  iban: z.string(),
  bankName: z.string(),
  reference: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  dueAt: z.string(),
})

/** Documents the `CatalogCheckoutStartResult` discriminated union. */
const checkoutStartResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("card_redirect"),
    bookingId: z.string(),
    paymentSessionId: z.string(),
    redirectUrl: z.string().nullable(),
    note: z.string().optional(),
  }),
  z.object({
    kind: z.literal("bank_transfer_instructions"),
    bookingId: z.string(),
    proformaId: z.string().nullable(),
    proformaNumber: z.string().nullable(),
    paymentSessionId: z.string().nullable(),
    instructions: bankTransferInstructionsSchema,
  }),
  z.object({
    kind: z.literal("inquiry_received"),
    bookingId: z.string(),
    inquiryId: z.string(),
    note: z.string().optional(),
  }),
  z.object({
    kind: z.literal("hold_placed"),
    bookingId: z.string(),
  }),
])

const checkoutStartRoute = createRoute({
  method: "post",
  path: "/checkout/start",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: checkoutStartSchema } },
    },
  },
  responses: {
    200: {
      description: "Checkout started — card redirect, bank-transfer, inquiry, or hold outcome",
      content: { "application/json": { schema: checkoutStartResultSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Booking not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Hold expired",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "Checkout setup is incomplete",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: {
      description: "Could not create payment session",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "Payment provider failed",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

/**
 * Build the storefront checkout routes. `options` may be a value or a
 * per-request factory — the deployment passes a factory when an injected
 * option needs to capture the request `Context` (e.g. resolving a payment
 * provider runtime from the per-request container).
 */
export function createCatalogCheckoutRoutes(
  options: CheckoutStartOptions | ((c: Context) => CheckoutStartOptions),
): OpenAPIHono<CheckoutEnv> {
  return stampOpenApiRegistryApiId(
    new OpenAPIHono<CheckoutEnv>({ defaultHook: openApiValidationHook }).openapi(
      checkoutStartRoute,
      async (c) => {
        const resolved = typeof options === "function" ? options(c) : options
        const body = c.req.valid("json")
        try {
          const result = await startCatalogCheckout(
            {
              db: c.get("db"),
              env: c.env,
              eventBus: c.var.eventBus,
              resolveRuntime: (key) => c.var.container?.resolve(key),
              requestMeta: checkoutRequestMeta(c),
              options: resolved,
            },
            body,
          )
          return c.json(result, 200)
        } catch (err) {
          if (err instanceof CatalogCheckoutStartError) {
            return c.json({ error: err.code }, err.status)
          }
          throw err
        }
      },
    ),
    "@voyant-travel/commerce#catalog-checkout-extension.api",
  )
}

export interface BookingMaintenanceRoutesOptions {
  resolveDb?(c: Context): PostgresJsDatabase
  resolveBookingTaxSettings: CheckoutModuleOptions["resolveBookingTaxSettings"]
}

const rebuildBookingTaxLinesRoute = createRoute({
  method: "post",
  path: "/{bookingId}/rebuild-tax-lines",
  request: {
    params: z.object({ bookingId: z.string().trim().min(1) }),
  },
  responses: {
    200: {
      description: "Booking item tax lines were rebuilt from catalog snapshots",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              rebuilt: z.number(),
              itemsWithoutSnapshot: z.number(),
            }),
          }),
        },
      },
    },
    400: {
      description: "invalid_request: route params failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createBookingMaintenanceRoutes(
  options: BookingMaintenanceRoutesOptions,
): OpenAPIHono<CheckoutEnv> {
  return stampOpenApiRegistryApiId(
    new OpenAPIHono<CheckoutEnv>({ defaultHook: openApiValidationHook }).openapi(
      rebuildBookingTaxLinesRoute,
      async (c) => {
        const db = options.resolveDb?.(c) ?? c.get("db")
        const result = await rebuildBookingItemTaxLines(db, c.req.valid("param").bookingId, {
          resolveBookingTaxSettings: options.resolveBookingTaxSettings,
        })
        return c.json({ data: result }, 200)
      },
    ),
    "@voyant-travel/commerce#booking-maintenance-extension.api",
  )
}

/** Package-owned checkout descriptor; payment and product providers stay injected. */
export function createCatalogCheckoutHonoExtension(
  options: CheckoutStartOptions | ((c: Context) => CheckoutStartOptions),
): HonoExtension {
  return {
    extension: {
      name: "catalog-checkout",
      module: "catalog",
      bootstrap: ({ container }) => {
        container.register(
          CATALOG_CHECKOUT_API_RUNTIME_KEY,
          typeof options === "function" ? options : () => options,
        )
      },
    },
    publicRoutes: createCatalogCheckoutRoutes(options),
  }
}

/** Package-owned maintenance descriptor; tax settings stay deployment-supplied. */
export function createBookingMaintenanceHonoExtension(
  options: BookingMaintenanceRoutesOptions,
): HonoExtension {
  return {
    extension: { name: "booking-maintenance", module: "bookings" },
    adminRoutes: createBookingMaintenanceRoutes(options),
  }
}

export const createBookingMaintenanceVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) =>
    createBookingMaintenanceHonoExtension(await getPort(bookingMaintenanceRuntimePort)),
)

function checkoutRequestMeta(c: Context): CheckoutStartRequestMeta {
  return {
    clientIp:
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "",
    userAgent: c.req.header("user-agent") ?? "",
  }
}
