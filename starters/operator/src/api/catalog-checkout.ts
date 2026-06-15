/**
 * Operator glue for the storefront checkout endpoint.
 *
 * The checkout logic lives in `@voyant-travel/commerce/checkout`. This file
 * wires the deployment's injected options and exposes:
 *   - `createCatalogCheckoutPublicRoutes()` — the public `POST /checkout/start`
 *     route, mounted under `/v1/public/catalog`.
 *   - `startCatalogCheckout(context, body)` — a thin wrapper that injects the
 *     operator options, for callers (e.g. trips-catalog-runtime) that drive the
 *     service directly.
 */

import {
  type CatalogCheckoutStartContext,
  type CatalogCheckoutStartResult,
  type CheckoutStartInput,
  createCatalogCheckoutRoutes,
  startCatalogCheckout as packageStartCatalogCheckout,
} from "@voyant-travel/commerce/checkout"
import type { Hono } from "hono"
import { createOperatorCheckoutStartOptions } from "./catalog-checkout-options"

export {
  CatalogCheckoutStartError,
  type CatalogCheckoutStartResult,
  type CheckoutStartInput,
} from "@voyant-travel/commerce/checkout"

export function createCatalogCheckoutPublicRoutes(): Hono {
  return createCatalogCheckoutRoutes(createOperatorCheckoutStartOptions())
}

/** Drive the checkout-start service with this deployment's injected options. */
export function startCatalogCheckout(
  context: Omit<CatalogCheckoutStartContext, "options">,
  body: CheckoutStartInput,
): Promise<CatalogCheckoutStartResult> {
  return packageStartCatalogCheckout(
    { ...context, options: createOperatorCheckoutStartOptions() },
    body,
  )
}
