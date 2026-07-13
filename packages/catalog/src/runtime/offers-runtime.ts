import type {
  CatalogOffersAirportLabel,
  CatalogOffersConnectClient,
  CatalogOffersRouteModuleOptions,
} from "@voyant-travel/catalog/offers"
import { createCatalogOffersTypesenseResolvers } from "@voyant-travel/catalog/runtime-support"
import { createVoyantConnectClient } from "@voyant-travel/connect-sdk"
import { createDestinationNameResolver } from "@voyant-travel/plugin-voyant-connect"
import type { Context } from "hono"

interface PackageOffersEnv {
  VOYANT_API_KEY?: string
  VOYANT_CONNECT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CONNECT_OPERATOR_ID?: string
  VOYANT_CONNECT_API_URL?: string
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
}

function connectApiKey(env: PackageOffersEnv): string | undefined {
  return env.VOYANT_API_KEY ?? env.VOYANT_CONNECT_API_KEY ?? env.VOYANT_CLOUD_API_KEY
}

function resolveConnectClient(c: Context): CatalogOffersConnectClient | null {
  const env = c.env as PackageOffersEnv
  const apiKey = connectApiKey(env)
  const operatorId = env.VOYANT_CONNECT_OPERATOR_ID
  if (!apiKey || !operatorId) return null
  return createVoyantConnectClient({
    apiKey,
    operatorId,
    ...(env.VOYANT_CONNECT_API_URL ? { baseUrl: env.VOYANT_CONNECT_API_URL } : {}),
  }) as CatalogOffersConnectClient
}

const typesenseResolvers = createCatalogOffersTypesenseResolvers(
  (context) => (context as Context).env as PackageOffersEnv,
)

async function resolveAirportLabels(
  c: Context,
  codes: string[],
): Promise<CatalogOffersAirportLabel[]> {
  const env = c.env as PackageOffersEnv
  const sorted = [...new Set(codes)].sort()
  const apiKey = connectApiKey(env)
  if (!apiKey || sorted.length === 0) return sorted.map((code) => ({ code, label: code }))
  let resolver: ReturnType<typeof createDestinationNameResolver> | null = null
  try {
    resolver = createDestinationNameResolver({ apiKey })
  } catch {
    resolver = null
  }
  return Promise.all(
    sorted.map(async (code) => {
      if (!resolver) return { code, label: code }
      try {
        const city = await resolver.resolve(code)
        return { code, label: city && city !== code ? `${city} (${code})` : code }
      } catch {
        return { code, label: code }
      }
    }),
  )
}

export function createOperatorCatalogOffersRouteModuleOptions(): CatalogOffersRouteModuleOptions {
  return {
    resolveConnectClient,
    fetchIndexFields: typesenseResolvers.fetchIndexFields,
    resolveDynamicHotelIds: typesenseResolvers.resolveDynamicHotelIds,
    resolveAirportLabels,
  }
}
