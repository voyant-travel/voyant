import type { VoyantGeneratedRouteFile } from "@voyant-travel/vite-config"

const contributionRoute = (
  path: string,
  routeId: string,
  contribution: "localAuthRouteContribution" | "storefrontPresentationContribution",
  member: string,
): VoyantGeneratedRouteFile => ({
  path,
  source: `
import { createFileRoute } from "@tanstack/react-router"
import { ${contribution} } from "@/lib/${
    contribution === "localAuthRouteContribution" ? "local-auth-bootstrap" : "storefront-messages"
  }"

export const Route = createFileRoute(${JSON.stringify(routeId)})(${contribution}.routes.${member})
`,
})

const localRouteOptions = (
  path: string,
  routeId: string,
  module: string,
): VoyantGeneratedRouteFile => ({
  path,
  source: `
import { createFileRoute } from "@tanstack/react-router"
import { routeOptions } from "@/routes/${module}"

export const Route = createFileRoute(${JSON.stringify(routeId)})(routeOptions)
`,
})

const contributedPublicRoute = (
  path: string,
  routeId: string,
  contribution: "financePublicRoutes" | "quotesPublicRoutes",
  member: string,
): VoyantGeneratedRouteFile => ({
  path,
  source: `
import { createFileRoute } from "@tanstack/react-router"
import { ${contribution} } from "@/lib/public-route-contributions"

export const Route = createFileRoute(${JSON.stringify(routeId)})(${contribution}.routes.${member})
`,
})

/** Standard package-owned route registrations emitted into `.voyant/routes`. */
export const standardOperatorRouteFiles: readonly VoyantGeneratedRouteFile[] = [
  {
    path: "__root.tsx",
    source: `
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, useRouteContext } from "@tanstack/react-router"
import { AdminRootErrorBoundary, AdminRootShell, adminRootHead } from "@voyant-travel/admin/app/root"
import { Toaster } from "@voyant-travel/ui/components"
import { Providers } from "@/components/providers"
import "@/styles.css"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => adminRootHead({ title: "Voyant", description: "Voyant operator workspace", faviconHref: "/favicon.png" }),
  shellComponent: AdminRootShell,
  component: RootComponent,
  errorComponent: AdminRootErrorBoundary,
})

function RootComponent() {
  const queryClient = useRouteContext({ from: "__root__", select: (context) => context.queryClient })
  return <Providers queryClient={queryClient}><Outlet /><Toaster /></Providers>
}
`,
  },
  contributedPublicRoute(
    "accountant.$token.tsx",
    "/accountant/$token",
    "financePublicRoutes",
    "accountant",
  ),
  localRouteOptions("docs.tsx", "/docs", "docs"),
  contributedPublicRoute("pay.tsx", "/pay", "financePublicRoutes", "pay"),
  contributedPublicRoute(
    "pay_.$sessionId.tsx",
    "/pay_/$sessionId",
    "financePublicRoutes",
    "paymentLink",
  ),
  contributedPublicRoute(
    "proposal.$quoteVersionId.tsx",
    "/proposal/$quoteVersionId",
    "quotesPublicRoutes",
    "proposal",
  ),
  contributionRoute("(auth)/route.tsx", "/(auth)", "localAuthRouteContribution", "layout"),
  contributionRoute(
    "(auth)/accept-invitation.tsx",
    "/(auth)/accept-invitation",
    "localAuthRouteContribution",
    "acceptInvitation",
  ),
  contributionRoute(
    "(auth)/accept-invite.tsx",
    "/(auth)/accept-invite",
    "localAuthRouteContribution",
    "acceptInvite",
  ),
  contributionRoute(
    "(auth)/forgot-password.tsx",
    "/(auth)/forgot-password",
    "localAuthRouteContribution",
    "forgotPassword",
  ),
  contributionRoute(
    "(auth)/onboarding.tsx",
    "/(auth)/onboarding",
    "localAuthRouteContribution",
    "onboarding",
  ),
  contributionRoute(
    "(auth)/reset-password.tsx",
    "/(auth)/reset-password",
    "localAuthRouteContribution",
    "resetPassword",
  ),
  contributionRoute(
    "(auth)/sign-in.tsx",
    "/(auth)/sign-in",
    "localAuthRouteContribution",
    "signIn",
  ),
  contributionRoute(
    "(auth)/sign-up.tsx",
    "/(auth)/sign-up",
    "localAuthRouteContribution",
    "signUp",
  ),
  contributionRoute(
    "(auth)/verify-email.tsx",
    "/(auth)/verify-email",
    "localAuthRouteContribution",
    "verifyEmail",
  ),
  contributionRoute(
    "(storefront)/route.tsx",
    "/(storefront)",
    "storefrontPresentationContribution",
    "layout",
  ),
  contributionRoute(
    "(storefront)/shop.tsx",
    "/(storefront)/shop",
    "storefrontPresentationContribution",
    "shop",
  ),
  contributionRoute(
    "(storefront)/shop_.account.tsx",
    "/(storefront)/shop_/account",
    "storefrontPresentationContribution",
    "account",
  ),
  contributionRoute(
    "(storefront)/shop_.account.sign-in.tsx",
    "/(storefront)/shop_/account/sign-in",
    "storefrontPresentationContribution",
    "accountSignIn",
  ),
  contributionRoute(
    "(storefront)/shop_.account.sign-up.tsx",
    "/(storefront)/shop_/account/sign-up",
    "storefrontPresentationContribution",
    "accountSignUp",
  ),
  contributionRoute(
    "(storefront)/shop_.account.verify-email.tsx",
    "/(storefront)/shop_/account/verify-email",
    "storefrontPresentationContribution",
    "accountVerifyEmail",
  ),
  contributionRoute(
    "(storefront)/shop_.book.$entityModule.$entityId.tsx",
    "/(storefront)/shop_/book/$entityModule/$entityId",
    "storefrontPresentationContribution",
    "booking",
  ),
  contributionRoute(
    "(storefront)/shop_.composer.tsx",
    "/(storefront)/shop_/composer",
    "storefrontPresentationContribution",
    "composer",
  ),
  contributionRoute(
    "(storefront)/shop_.confirmation.$bookingId.tsx",
    "/(storefront)/shop_/confirmation/$bookingId",
    "storefrontPresentationContribution",
    "confirmation",
  ),
  contributionRoute(
    "(storefront)/shop_.products.$entityModule.$entityId.tsx",
    "/(storefront)/shop_/products/$entityModule/$entityId",
    "storefrontPresentationContribution",
    "productDetail",
  ),
  {
    path: "_workspace/route.tsx",
    source: `
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { createAdminHostWorkspace } from "@voyant-travel/admin-host/workspace"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import { AdminWorkspaceRealtimeProvider } from "@voyant-travel/realtime-react"
import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import { operatorAdminPresentation } from "@/lib/admin-presentation"
import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { projectFetcher } from "@/lib/voyant-fetcher"

const workspace = createAdminHostWorkspace({
  auth: adminAuthRuntime,
  presentation: operatorAdminPresentation,
  api: { getBaseUrl: getApiUrl, fetcher: projectFetcher },
  realtime: { Provider: AdminWorkspaceRealtimeProvider, channel: RealtimeChannel, useSession: authClient.useSession },
})

export const Route = createFileRoute("/_workspace")({
  ssr: "data-only",
  beforeLoad: ({ location }) => workspace.beforeLoad({ location }),
  loader: ({ context }) => ({ user: context.user }),
  pendingComponent: workspace.PendingComponent,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user } = Route.useLoaderData()
  return <workspace.Workspace initialUser={user}><Outlet /></workspace.Workspace>
}
`,
  },
]
