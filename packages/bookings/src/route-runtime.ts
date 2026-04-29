import { createKmsProviderFromEnv, type KmsProvider } from "@voyantjs/utils"

import type { KmsBindings } from "./routes-shared.js"

export const BOOKING_ROUTE_RUNTIME_CONTAINER_KEY = "runtime.bookings.routes"

export interface BookingRouteRuntime {
  getKmsProvider(): Promise<KmsProvider>
}

/**
 * Hook for apps that source their KMS key material from somewhere other than
 * env vars / wrangler secrets — e.g. Voyant Cloud Vault. Receives the same
 * resolved bindings the default env-driven provider would, returns the
 * provider (sync or async). When omitted, falls back to
 * `createKmsProviderFromEnv` so existing template wiring keeps working.
 */
export type ResolveBookingKmsProvider = (
  env: Record<string, string | undefined>,
) => KmsProvider | Promise<KmsProvider>

export interface BookingRouteRuntimeOptions {
  resolveKmsProvider?: ResolveBookingKmsProvider
}

function buildRuntimeEnv(bindings: KmsBindings): Record<string, string | undefined> {
  const processEnv =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process?.env ?? {}

  return {
    ...processEnv,
    ...(bindings ?? {}),
  }
}

export function buildBookingRouteRuntime(
  bindings: KmsBindings,
  options: BookingRouteRuntimeOptions = {},
): BookingRouteRuntime {
  const runtimeEnv = buildRuntimeEnv(bindings)

  return {
    async getKmsProvider() {
      if (options.resolveKmsProvider) {
        return options.resolveKmsProvider(runtimeEnv)
      }
      return createKmsProviderFromEnv(runtimeEnv)
    },
  }
}
