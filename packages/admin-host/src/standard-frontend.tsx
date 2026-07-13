import { apiKeyClient } from "@better-auth/api-key/client"
import type { QueryClient } from "@tanstack/react-query"
import type { AnyRoute } from "@tanstack/react-router"
import { createMiddleware, createServerFn } from "@tanstack/react-start"
import type { AdminAuthRuntime } from "@voyant-travel/admin/app"
import {
  type AdminRouterContext,
  attachAdminExtensionRoutes,
  buildAdminExtensionRoutes,
  createAdminRouter,
} from "@voyant-travel/admin/app"
import { useLocale } from "@voyant-travel/admin/providers/locale"
import { useOperatorAdminMessages } from "@voyant-travel/admin/providers/operator-admin-messages"
import {
  type AdminChildProvider,
  OperatorAdminShellProvider,
} from "@voyant-travel/admin/providers/operator-admin-shell"
import { adminFetcher, getAdminApiUrl } from "@voyant-travel/admin-app/runtime"
import { createLocalAuthRouteContribution } from "@voyant-travel/auth-react/local-auth-routes"
import type { RedeemInvitationStatus } from "@voyant-travel/auth-react/ui"
import {
  StorefrontBookingPage,
  type StorefrontBookingSearch,
  storefrontBookingSearchSchema,
} from "@voyant-travel/bookings-react/storefront"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import { CruiseDetailPage } from "@voyant-travel/cruises-react/storefront"
import { createFinancePublicRouteContribution } from "@voyant-travel/finance-react/public-routes"
import { ProductDetailPageProducts } from "@voyant-travel/inventory-react/storefront"
import { VoyantAvailabilityProvider } from "@voyant-travel/operations-react/availability/provider"
import { createQuotesPublicRouteContribution } from "@voyant-travel/quotes-react/public-routes"
import { AdminWorkspaceRealtimeProvider } from "@voyant-travel/realtime-react"
import {
  AccommodationDetailPage,
  createStorefrontMessagesProvider,
  createStorefrontPresentationContribution,
  type StorefrontBookingRouteProps,
  type StorefrontComposerRouteProps,
  useStorefrontMessages,
} from "@voyant-travel/storefront-react/storefront"
import { StorefrontComposerPage } from "@voyant-travel/trips-react/storefront"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { TooltipProvider } from "@voyant-travel/ui/components/tooltip"
import { emailOTPClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { ReactNode } from "react"

import { type AdminHostPresentation, createAdminHostPresentation } from "./admin-presentation.js"
import { createApiDocsRouteOptions, type OpenApiSpecLoaders } from "./standard-api-docs.js"
import { createAdminHostWorkspace } from "./workspace.js"

export interface StandardOperatorCurrentUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  locale: string
  timezone: string | null
  uiPrefs: Record<string, unknown> | null
  isSuperAdmin: boolean
  isSupportUser: boolean
  createdAt: string
  profilePictureUrl?: string | null
}

export interface CreateStandardOperatorFrontendOptions {
  accessCatalog: AccessCatalog
  selected: Parameters<typeof createAdminHostPresentation>[0]["selected"]
  project?: Record<string, unknown>
  openApiSpecs?: OpenApiSpecLoaders
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const authClient = createAuthClient({
  baseURL: `${getAdminApiUrl()}/auth`,
  plugins: [apiKeyClient(), organizationClient(), emailOTPClient()],
  fetchOptions: { credentials: "include" },
})

function cloudAuthStartHref(next?: string): string {
  const params = new URLSearchParams()
  if (next) params.set("next", next)
  const query = params.toString()
  return `/api/auth/cloud/start${query ? `?${query}` : ""}`
}

function shouldUseBrowserEvidenceFallback(request: Request): boolean {
  const hostname = new URL(request.url).hostname
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost"
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.VOYANT_OPERATOR_BROWSER_EVIDENCE === "1" && isLocal
}

const withRequest = createMiddleware({ type: "request" }).server(({ next, request }) =>
  next({ context: { request } }),
)

const getBootstrapStatus = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (shouldUseBrowserEvidenceFallback(context.request)) return { hasUsers: true }
    const response = await fetch(new URL("/api/auth/bootstrap-status", context.request.url))
    if (!response.ok) throw new Error("Failed to fetch bootstrap status")
    return (await response.json()) as {
      hasUsers: boolean
      authMode?: "local" | "voyant-cloud"
    }
  })

const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (shouldUseBrowserEvidenceFallback(context.request)) return null
    const headers = new Headers()
    const cookie = context.request.headers.get("cookie")
    if (cookie) headers.set("cookie", cookie)
    const response = await fetch(new URL("/api/auth/me", context.request.url), { headers })
    if (response.status === 401) return null
    if (!response.ok) throw new Error("Failed to fetch current user")
    return (await response.json()) as StandardOperatorCurrentUser
  })

const adminAuthRuntime: AdminAuthRuntime<StandardOperatorCurrentUser> = {
  getCurrentUser,
  getBootstrapStatus,
  cloudAuthStartHref,
  signOut: async () => {
    await authClient.signOut()
  },
}

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await adminFetcher(`${getAdminApiUrl()}${path}`, {
    ...options,
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => undefined)
    const detail = body as { error?: string | { message?: string } } | undefined
    const message =
      typeof detail?.error === "string"
        ? detail.error
        : (detail?.error?.message ?? `API error: ${response.status} ${response.statusText}`)
    throw new ApiError(message, response.status, body)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const useStorefrontLocale = () => useLocale().resolvedLocale

function createPresentationRuntime(presentation: AdminHostPresentation) {
  const StorefrontMessagesProvider = createStorefrontMessagesProvider(useStorefrontLocale)
  const storefront = createStorefrontPresentationContribution({
    BookingPage: StandardStorefrontBookingPage,
    ComposerPage: StandardStorefrontComposerPage,
    bookingSearchSchema: storefrontBookingSearchSchema,
    getApiUrl: getAdminApiUrl,
    projectFetcher: adminFetcher,
    renderProductDetail: (entityModule, entityId) => {
      if (entityModule === "accommodations") return <AccommodationDetailPage entityId={entityId} />
      if (entityModule === "cruises") return <CruiseDetailPage entityId={entityId} />
      return <ProductDetailPageProducts entityModule={entityModule} entityId={entityId} />
    },
    resendVerification: (email) =>
      authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }),
    signOut: () => authClient.signOut(),
    useLocale: useStorefrontLocale,
    useSession: () => authClient.useSession(),
  })
  const finance = createFinancePublicRouteContribution({
    getApiUrl: getAdminApiUrl,
    StorefrontMessagesProvider,
    usePaymentResolverMessages: () => useStorefrontMessages().pay,
    usePaymentLinkMessages: () => ({
      ...useStorefrontMessages().pay,
      bookingSummary: useOperatorAdminMessages().bookings.detail.paymentLinkSummary,
      tripSummary: useOperatorAdminMessages().trips.paymentLinkSummary,
    }),
  })
  const quotes = createQuotesPublicRouteContribution({
    getApiUrl: getAdminApiUrl,
    StorefrontMessagesProvider,
    useProposalMessages: () => useStorefrontMessages().proposal,
  })
  const localAuth = createLocalAuthRouteContribution({
    getCurrentUser,
    getBootstrapStatus,
    cloudAuthStartHref,
    useMessages: () => useOperatorAdminMessages().auth,
    getInvitation: (token) =>
      apiCall<RedeemInvitationStatus>(`/v1/public/invitations/${encodeURIComponent(token)}`),
    redeemInvitation: async (token, input) => {
      await apiCall(`/v1/public/invitations/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    signInWithEmail: (input) => authClient.signIn.email(input),
    signInWithSocial: (provider, callbackURL) =>
      authClient.signIn.social({ provider, callbackURL }),
    sendVerificationOtp: (email) =>
      authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }),
    refreshAuthStatus: () => fetch(`${getAdminApiUrl()}/auth/status`, { credentials: "include" }),
  })
  const workspace = createAdminHostWorkspace({
    auth: adminAuthRuntime,
    presentation,
    api: { getBaseUrl: getAdminApiUrl, fetcher: adminFetcher },
    realtime: {
      Provider: AdminWorkspaceRealtimeProvider,
      channel: RealtimeChannel,
      useSession: authClient.useSession,
    },
  })
  return { finance, localAuth, quotes, storefront, workspace }
}

export function createStandardOperatorFrontend(options: CreateStandardOperatorFrontendOptions) {
  const presentation = createAdminHostPresentation(options)
  const runtime = createPresentationRuntime(presentation)
  const AvailabilityProvider: AdminChildProvider = ({ children }) => (
    <VoyantAvailabilityProvider baseUrl={getAdminApiUrl()} fetcher={adminFetcher}>
      {children}
    </VoyantAvailabilityProvider>
  )
  const providers = [TooltipProvider, AvailabilityProvider] satisfies readonly AdminChildProvider[]

  function Providers({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
    return (
      <OperatorAdminShellProvider
        baseUrl={getAdminApiUrl()}
        fetcher={adminFetcher}
        queryClient={queryClient}
        providers={providers}
      >
        {children}
      </OperatorAdminShellProvider>
    )
  }

  return {
    Providers,
    presentation,
    workspace: runtime.workspace,
    routes: {
      docs: createApiDocsRouteOptions(options.openApiSpecs ?? {}),
      finance: runtime.finance.routes,
      localAuth: runtime.localAuth.routes,
      quotes: runtime.quotes.routes,
      storefront: runtime.storefront.routes,
    },
    createRouter<TRouteTree extends AnyRoute>({
      routeTree,
      workspaceRoute,
    }: {
      routeTree: TRouteTree
      workspaceRoute: AnyRoute
    }) {
      const adminRoutes = buildAdminExtensionRoutes(
        presentation.extensions,
        () => workspaceRoute,
        () => ({ baseUrl: getAdminApiUrl(), fetcher: adminFetcher }),
      )
      return createAdminRouter({
        routeTree: attachAdminExtensionRoutes(routeTree, workspaceRoute, adminRoutes),
      })
    },
  }
}

export type StandardOperatorRouterContext = AdminRouterContext

function StandardStorefrontBookingPage({ search, ...props }: StorefrontBookingRouteProps) {
  return <StorefrontBookingPage {...props} search={search as StorefrontBookingSearch} />
}

function StandardStorefrontComposerPage(props: StorefrontComposerRouteProps) {
  return (
    <StorefrontComposerPage
      {...props}
      messages={useOperatorAdminMessages().trips.storefrontComposer}
    />
  )
}
