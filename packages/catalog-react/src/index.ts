// HTTP client + error type — re-exported for callers that want to bypass
// the hook layer (e.g. for SSR loaders).
export {
  defaultFetcher,
  type FetchWithValidationOptions,
  fetchWithValidation,
  VoyantApiError,
  type VoyantFetcher,
} from "./client.js"
export {
  type CatalogSearchFilter,
  type CatalogSearchMode,
  type UseCatalogSearchOptions,
  useCatalogSearch,
} from "./hooks/index.js"
// Provider: the same VoyantReactProvider as products-react / suppliers-react,
// re-exported under catalog naming for ergonomics in apps that compose
// multiple modules.
export {
  useVoyantCatalogContext,
  type VoyantCatalogContextValue,
  VoyantCatalogProvider,
  type VoyantCatalogProviderProps,
} from "./provider.js"
export {
  type CatalogFacetBucket,
  type CatalogSearchDocument,
  type CatalogSearchHit,
  type CatalogSearchResponse,
  catalogSearchResponseSchema,
} from "./schemas.js"
