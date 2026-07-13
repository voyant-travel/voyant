import { useLocale } from "@voyant-travel/admin/providers/locale"
import {
  StorefrontBookingPage,
  type StorefrontBookingSearch,
  storefrontBookingSearchSchema,
} from "@voyant-travel/bookings-react/storefront"
import { CruiseDetailPage } from "@voyant-travel/cruises-react/storefront"
import { ProductDetailPageProducts } from "@voyant-travel/inventory-react/storefront"
import {
  AccommodationDetailPage,
  createStorefrontMessagesProvider,
  createStorefrontPresentationContribution,
  type StorefrontBookingRouteProps,
  type StorefrontComposerRouteProps,
  useStorefrontMessages,
} from "@voyant-travel/storefront-react/storefront"
import { StorefrontComposerPage } from "@voyant-travel/trips-react/storefront"
import { useAdminMessages } from "./admin-i18n"
import { authClient } from "./auth"
import { getApiUrl } from "./env"
import { projectFetcher } from "./voyant-fetcher"

const useStorefrontLocale = () => useLocale().resolvedLocale

export const OperatorStorefrontMessagesProvider =
  createStorefrontMessagesProvider(useStorefrontLocale)

export const useOperatorStorefrontMessages = useStorefrontMessages

export const storefrontPresentationContribution = createStorefrontPresentationContribution({
  BookingPage: OperatorStorefrontBookingPage,
  ComposerPage: OperatorStorefrontComposerPage,
  bookingSearchSchema: storefrontBookingSearchSchema,
  getApiUrl,
  projectFetcher,
  renderProductDetail: (entityModule, entityId) => {
    if (entityModule === "accommodations") {
      return <AccommodationDetailPage entityId={entityId} />
    }
    if (entityModule === "cruises") return <CruiseDetailPage entityId={entityId} />
    return <ProductDetailPageProducts entityModule={entityModule} entityId={entityId} />
  },
  resendVerification: (email) =>
    authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }),
  signOut: () => authClient.signOut(),
  useLocale: useStorefrontLocale,
  useSession: () => authClient.useSession(),
})

function OperatorStorefrontBookingPage({ search, ...props }: StorefrontBookingRouteProps) {
  return <StorefrontBookingPage {...props} search={search as StorefrontBookingSearch} />
}

function OperatorStorefrontComposerPage(props: StorefrontComposerRouteProps) {
  return (
    <StorefrontComposerPage {...props} messages={useAdminMessages().trips.storefrontComposer} />
  )
}
