import {
  defaultFetcher,
  type VoyantAvailabilityContextValue,
} from "@voyant-travel/operations-react/availability"

import { getApiUrl } from "./env"

/**
 * Build the availability-react context value for use inside router loaders,
 * which run outside the React tree and so can't call `useVoyantAvailabilityContext`.
 * The runtime `VoyantAvailabilityProvider` wired in `Providers` covers the
 * component tree; this helper covers loader/pre-fetch paths.
 */
export function getAvailabilityContextValue(): VoyantAvailabilityContextValue {
  return { baseUrl: getApiUrl(), fetcher: defaultFetcher }
}
