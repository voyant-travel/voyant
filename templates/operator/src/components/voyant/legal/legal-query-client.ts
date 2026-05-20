import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher so SSR loaders forward the request cookie.
export const legalQueryClient = {
  baseUrl: getApiUrl(),
  fetcher: operatorFetcher,
} as const
