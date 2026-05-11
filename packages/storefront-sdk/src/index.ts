import { defaultStorefrontFetcher, type VoyantStorefrontClientOptions } from "./client.js"
import {
  canRunBookingEngineAction,
  createBookingEngineSnapshot,
  deriveBookingEngineState,
} from "./engine-state.js"
import {
  bootstrapCheckoutCollection,
  confirmPublicBookingSession,
  createPublicBookingSession,
  expirePublicBookingSession,
  getPublicBookingOverview,
  getPublicBookingSession,
  getPublicBookingSessionState,
  getStorefrontDeparture,
  getStorefrontDepartureItinerary,
  getStorefrontOfferBySlug,
  getStorefrontProductAvailability,
  getStorefrontSettings,
  initiateCheckoutCollection,
  listStorefrontProductDepartures,
  listStorefrontProductExtensions,
  listStorefrontProductOffers,
  previewCheckoutCollection,
  previewStorefrontDeparturePrice,
  repricePublicBookingSession,
  updatePublicBookingSession,
  updatePublicBookingSessionState,
} from "./operations.js"

export type {
  StorefrontQueryParamValue,
  StorefrontRequestOptions,
  VoyantStorefrontClientOptions,
  VoyantStorefrontFetcher,
} from "./client.js"
export {
  defaultStorefrontFetcher,
  storefrontFetchWithValidation,
  VoyantStorefrontApiError,
  withStorefrontQueryParams,
} from "./client.js"
export type {
  BookingEngineAction,
  BookingEngineSnapshot,
  BookingEngineState,
} from "./engine-state.js"
export {
  bookingEngineActions,
  bookingEngineStates,
  canRunBookingEngineAction,
  createBookingEngineSnapshot,
  deriveBookingEngineState,
  getAllowedBookingEngineActions,
} from "./engine-state.js"
export * from "./operations.js"
export * from "./schemas.js"

export function createVoyantStorefrontClient(options: VoyantStorefrontClientOptions) {
  const client = {
    baseUrl: options.baseUrl,
    fetcher: options.fetcher ?? defaultStorefrontFetcher,
    headers: options.headers,
  }

  return {
    storefront: {
      getSettings: () => getStorefrontSettings(client),
      getDeparture: (departureId: string) => getStorefrontDeparture(client, departureId),
      listProductDepartures: (
        productId: string,
        query?: Parameters<typeof listStorefrontProductDepartures>[2],
      ) => listStorefrontProductDepartures(client, productId, query),
      getProductAvailability: (
        productId: string,
        query?: Parameters<typeof getStorefrontProductAvailability>[2],
      ) => getStorefrontProductAvailability(client, productId, query),
      previewDeparturePrice: (
        departureId: string,
        input: Parameters<typeof previewStorefrontDeparturePrice>[2],
        requestOptions?: Parameters<typeof previewStorefrontDeparturePrice>[3],
      ) => previewStorefrontDeparturePrice(client, departureId, input, requestOptions),
      listProductExtensions: (
        productId: string,
        query?: Parameters<typeof listStorefrontProductExtensions>[2],
      ) => listStorefrontProductExtensions(client, productId, query),
      getDepartureItinerary: (productId: string, departureId: string) =>
        getStorefrontDepartureItinerary(client, productId, departureId),
      listProductOffers: (
        productId: string,
        query?: Parameters<typeof listStorefrontProductOffers>[2],
      ) => listStorefrontProductOffers(client, productId, query),
      getOfferBySlug: (slug: string, query?: Parameters<typeof getStorefrontOfferBySlug>[2]) =>
        getStorefrontOfferBySlug(client, slug, query),
    },
    booking: {
      createSession: (
        input: Parameters<typeof createPublicBookingSession>[1],
        requestOptions?: Parameters<typeof createPublicBookingSession>[2],
      ) => createPublicBookingSession(client, input, requestOptions),
      getSession: (sessionId: string) => getPublicBookingSession(client, sessionId),
      updateSession: (
        sessionId: string,
        input: Parameters<typeof updatePublicBookingSession>[2],
        requestOptions?: Parameters<typeof updatePublicBookingSession>[3],
      ) => updatePublicBookingSession(client, sessionId, input, requestOptions),
      getSessionState: (sessionId: string) => getPublicBookingSessionState(client, sessionId),
      updateSessionState: (
        sessionId: string,
        input: Parameters<typeof updatePublicBookingSessionState>[2],
        requestOptions?: Parameters<typeof updatePublicBookingSessionState>[3],
      ) => updatePublicBookingSessionState(client, sessionId, input, requestOptions),
      reprice: (
        sessionId: string,
        input: Parameters<typeof repricePublicBookingSession>[2],
        requestOptions?: Parameters<typeof repricePublicBookingSession>[3],
      ) => repricePublicBookingSession(client, sessionId, input, requestOptions),
      confirm: (
        sessionId: string,
        input?: Parameters<typeof confirmPublicBookingSession>[2],
        requestOptions?: Parameters<typeof confirmPublicBookingSession>[3],
      ) => confirmPublicBookingSession(client, sessionId, input, requestOptions),
      expire: (
        sessionId: string,
        input?: Parameters<typeof expirePublicBookingSession>[2],
        requestOptions?: Parameters<typeof expirePublicBookingSession>[3],
      ) => expirePublicBookingSession(client, sessionId, input, requestOptions),
      getOverview: (query: Parameters<typeof getPublicBookingOverview>[1]) =>
        getPublicBookingOverview(client, query),
      deriveState: deriveBookingEngineState,
      createSnapshot: createBookingEngineSnapshot,
      canRunAction: canRunBookingEngineAction,
    },
    checkout: {
      previewCollection: (
        bookingId: string,
        input: Parameters<typeof previewCheckoutCollection>[2],
        requestOptions?: Parameters<typeof previewCheckoutCollection>[3],
      ) => previewCheckoutCollection(client, bookingId, input, requestOptions),
      initiateCollection: (
        bookingId: string,
        input: Parameters<typeof initiateCheckoutCollection>[2],
        requestOptions?: Parameters<typeof initiateCheckoutCollection>[3],
      ) => initiateCheckoutCollection(client, bookingId, input, requestOptions),
      bootstrapCollection: (
        input: Parameters<typeof bootstrapCheckoutCollection>[1],
        requestOptions?: Parameters<typeof bootstrapCheckoutCollection>[2],
      ) => bootstrapCheckoutCollection(client, input, requestOptions),
    },
  }
}

export type VoyantStorefrontClient = ReturnType<typeof createVoyantStorefrontClient>
