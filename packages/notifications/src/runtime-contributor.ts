import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  type FinanceNotificationsRuntime,
  financeNotificationsRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import {
  type QuotesNotificationsRuntime,
  quotesNotificationsRuntimePort,
} from "@voyant-travel/quotes/runtime-port"
import { storefrontVerificationRuntimePort } from "@voyant-travel/storefront"
import type { StorefrontVerificationRoutesOptions } from "@voyant-travel/storefront/verification"
import { createFinanceNotificationsRuntime } from "./finance-runtime.js"
import { createQuotesNotificationsRuntime } from "./quotes-runtime.js"
import { createNotificationsRuntime } from "./runtime.js"
import { notificationsRuntimePort } from "./runtime-port.js"
import { notificationsReminderJobRuntimePort } from "./reminder-job.js"

export interface NotificationsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute Notifications and its narrow Finance integration. */
export function createNotificationsRuntimePortContribution(
  host: NotificationsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = createNotificationsRuntime(host.primitives)
  const verification = {
    resolveProviders(bindings: Record<string, unknown>) {
      const resolver = host.primitives.config.read(bindings, "notificationProviders")
      return typeof resolver === "function" ? resolver(host.primitives.env(bindings)) : []
    },
    email: { subject: "Your verification code" },
  } satisfies StorefrontVerificationRoutesOptions
  return {
    [notificationsRuntimePort.id]: runtime,
    [notificationsReminderJobRuntimePort.id]: runtime.resolveReminderJobRuntime(undefined),
    [storefrontVerificationRuntimePort.id]: verification,
    [financeNotificationsRuntimePort.id]: createFinanceNotificationsRuntime(
      host.primitives,
    ) satisfies FinanceNotificationsRuntime,
    [quotesNotificationsRuntimePort.id]: createQuotesNotificationsRuntime(
      host.primitives,
    ) satisfies QuotesNotificationsRuntime,
  }
}
