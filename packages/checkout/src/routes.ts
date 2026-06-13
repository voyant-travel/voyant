import type { Module } from "@voyantjs/core"
import {
  buildFinanceCheckoutRouteRuntime,
  CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY,
  type CheckoutNotificationDispatcher,
  createFinanceCheckoutAdminRoutes,
  createFinanceCheckoutRoutes,
  type CheckoutRouteRuntime as FinanceCheckoutRouteRuntime,
  type CheckoutRoutesOptions as FinanceCheckoutRoutesOptions,
} from "@voyantjs/finance"
import type { HonoModule } from "@voyantjs/hono/module"
import type { NotificationProvider } from "@voyantjs/notifications"
import { createNotificationService } from "@voyantjs/notifications"
import { notificationDispatcherFor } from "./service.js"
import { listBookingReminderRuns } from "./service-reminder-runs.js"

export { CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY }

export type CheckoutRoutesOptions = FinanceCheckoutRoutesOptions & {
  providers?: ReadonlyArray<NotificationProvider>
  resolveProviders?: (bindings: Record<string, unknown>) => ReadonlyArray<NotificationProvider>
}

export type CheckoutRouteRuntime = FinanceCheckoutRouteRuntime & {
  providers: ReadonlyArray<NotificationProvider>
}

function dispatcherFromProviders(
  providers: ReadonlyArray<NotificationProvider>,
): CheckoutNotificationDispatcher | null {
  if (providers.length === 0) return null
  const service = createNotificationService(providers)

  return notificationDispatcherFor(service)
}

function resolveProviders(
  bindings: Record<string, unknown>,
  options: CheckoutRoutesOptions,
): ReadonlyArray<NotificationProvider> {
  return options.resolveProviders?.(bindings) ?? options.providers ?? []
}

function toFinanceOptions(options: CheckoutRoutesOptions = {}): FinanceCheckoutRoutesOptions {
  return {
    ...options,
    resolveNotificationDispatcher: (bindings) =>
      options.resolveNotificationDispatcher?.(bindings) ??
      options.notificationDispatcher ??
      dispatcherFromProviders(resolveProviders(bindings, options)),
    listBookingReminderRuns: options.listBookingReminderRuns ?? listBookingReminderRuns,
  }
}

export function createCheckoutRoutes(options: CheckoutRoutesOptions = {}) {
  return createFinanceCheckoutRoutes(toFinanceOptions(options))
}

export function createCheckoutAdminRoutes(options: CheckoutRoutesOptions = {}) {
  return createFinanceCheckoutAdminRoutes(toFinanceOptions(options))
}

export const checkoutModule: Module = {
  name: "checkout",
}

export function createCheckoutHonoModule(options: CheckoutRoutesOptions = {}): HonoModule {
  const module: Module = {
    ...checkoutModule,
    bootstrap: ({ bindings, container }) => {
      container.register(
        CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY,
        buildCheckoutRouteRuntime(bindings as Record<string, unknown>, options),
      )
    },
  }

  return {
    module,
    publicRoutes: createCheckoutRoutes(options),
    adminRoutes: createCheckoutAdminRoutes(options),
  }
}

export function buildCheckoutRouteRuntime(
  bindings: Record<string, unknown>,
  options: CheckoutRoutesOptions = {},
): CheckoutRouteRuntime {
  return {
    ...buildFinanceCheckoutRouteRuntime(bindings, toFinanceOptions(options)),
    providers: resolveProviders(bindings, options),
  }
}
