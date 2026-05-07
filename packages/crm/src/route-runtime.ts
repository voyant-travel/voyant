import { createKmsProviderFromEnv, type KmsProvider } from "@voyantjs/utils"

export const CRM_ROUTE_RUNTIME_CONTAINER_KEY = "runtime.crm.routes"

/**
 * Hook for apps that source KMS keys from somewhere other than env
 * vars / wrangler secrets. Mirrors the same hook in
 * `@voyantjs/bookings`.
 */
export type ResolveCrmKmsProvider = (
  env: Record<string, string | undefined>,
) => KmsProvider | Promise<KmsProvider>

export interface CrmRouteRuntime {
  /**
   * Returns the configured KMS provider, or `null` when no provider
   * is wired (e.g. dev environments without KMS keys). Routes that
   * require KMS gracefully reject with a 503 in that case.
   */
  getKmsProvider(): Promise<KmsProvider | null>
}

export interface CrmRouteRuntimeOptions {
  resolveKmsProvider?: ResolveCrmKmsProvider
}

function buildRuntimeEnv(bindings: Record<string, unknown>): Record<string, string | undefined> {
  const processEnv =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process?.env ?? {}

  const flat: Record<string, string | undefined> = { ...processEnv }
  for (const [key, value] of Object.entries(bindings ?? {})) {
    if (typeof value === "string" || value === undefined) {
      flat[key] = value
    }
  }
  return flat
}

export function buildCrmRouteRuntime(
  bindings: Record<string, unknown>,
  options: CrmRouteRuntimeOptions = {},
): CrmRouteRuntime {
  const runtimeEnv = buildRuntimeEnv(bindings)

  return {
    async getKmsProvider() {
      try {
        if (options.resolveKmsProvider) {
          return await options.resolveKmsProvider(runtimeEnv)
        }
        return await createKmsProviderFromEnv(runtimeEnv)
      } catch {
        return null
      }
    },
  }
}
