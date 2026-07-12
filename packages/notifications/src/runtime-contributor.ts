import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { storefrontVerificationRuntimePort } from "@voyant-travel/storefront"
import type { StorefrontVerificationRoutesOptions } from "@voyant-travel/storefront/verification"
import { createNotificationsRuntime } from "./runtime.js"
import { notificationsRuntimePort } from "./runtime-port.js"

export interface NotificationsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute the standard Node Notifications adapter selected by the framework BOM. */
export function createNotificationsRuntimePortContribution(
  host: NotificationsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const verification = {
    resolveProviders(bindings: Record<string, unknown>) {
      const resolver = host.primitives.config.read(bindings, "notificationProviders")
      return typeof resolver === "function" ? resolver(host.primitives.env(bindings)) : []
    },
    email: { subject: "Your verification code" },
  } satisfies StorefrontVerificationRoutesOptions
  return {
    [notificationsRuntimePort.id]: createNotificationsRuntime(host.primitives),
    [storefrontVerificationRuntimePort.id]: verification,
  }
}
