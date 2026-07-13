import type { VoyantGeneratedRouteFile } from "@voyant-travel/vite-config"

const runtimeImport = (path: string) =>
  path.includes("/") ? "../_lib/operator-frontend" : "./_lib/operator-frontend"

const contributionRoute = (
  path: string,
  routeId: string,
  contribution: "localAuth" | "storefront",
  member: string,
): VoyantGeneratedRouteFile => ({
  path,
  source: `
import { createFileRoute } from "@tanstack/react-router"
import { operatorFrontend } from ${JSON.stringify(runtimeImport(path))}

export const Route = createFileRoute(${JSON.stringify(routeId)})(operatorFrontend.routes.${contribution}.${member})
`,
})

const contributedPublicRoute = (
  path: string,
  routeId: string,
  contribution: "finance" | "quotes",
  member: string,
): VoyantGeneratedRouteFile => ({
  path,
  source: `
import { createFileRoute } from "@tanstack/react-router"
import { operatorFrontend } from ${JSON.stringify(runtimeImport(path))}

export const Route = createFileRoute(${JSON.stringify(routeId)})(operatorFrontend.routes.${contribution}.${member})
`,
})

/** Standard package-owned route registrations emitted into `.voyant/routes`. */
export const standardOperatorRouteFiles: readonly VoyantGeneratedRouteFile[] = [
  {
    path: "_lib/operator-frontend.tsx",
    source: `
import { createStandardOperatorFrontend } from "@voyant-travel/admin-host/standard-frontend"
import { accessCatalog } from "../../access/selected-access-catalog.generated"
import { createSelectedGraphAdminExtensions } from "../../admin/selected-graph-admin.generated"

const workspaceSpecs = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../../../../packages/*/openapi/{admin,storefront}/*.json",
)
const installedSpecs = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../../node_modules/@voyant-travel/*/openapi/{admin,storefront}/*.json",
)

export const operatorFrontend = createStandardOperatorFrontend({
  accessCatalog,
  selected: createSelectedGraphAdminExtensions,
  project: import.meta.glob("../../../src/admin/*/index.tsx", { eager: true }),
  openApiSpecs: { ...workspaceSpecs, ...installedSpecs },
})
`,
  },
  {
    path: "__root.tsx",
    source: `
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, useRouteContext } from "@tanstack/react-router"
import { AdminRootErrorBoundary, AdminRootShell, adminRootHead } from "@voyant-travel/admin/app/root"
import { Toaster } from "@voyant-travel/ui/components"
import { operatorFrontend } from "./_lib/operator-frontend"
import "@/styles.css"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => adminRootHead({ title: "Voyant", description: "Voyant operator workspace", faviconHref: "/favicon.png" }),
  shellComponent: AdminRootShell,
  component: RootComponent,
  errorComponent: AdminRootErrorBoundary,
})

function RootComponent() {
  const queryClient = useRouteContext({ from: "__root__", select: (context) => context.queryClient })
  return <operatorFrontend.Providers queryClient={queryClient}><Outlet /><Toaster /></operatorFrontend.Providers>
}
`,
  },
  contributedPublicRoute("accountant.$token.tsx", "/accountant/$token", "finance", "accountant"),
  {
    path: "docs.tsx",
    source: `
import { createFileRoute } from "@tanstack/react-router"
import { operatorFrontend } from "./_lib/operator-frontend"

export const Route = createFileRoute("/docs")(operatorFrontend.routes.docs)
`,
  },
  contributedPublicRoute("pay.tsx", "/pay", "finance", "pay"),
  contributedPublicRoute("pay_.$sessionId.tsx", "/pay_/$sessionId", "finance", "paymentLink"),
  contributedPublicRoute(
    "proposal.$quoteVersionId.tsx",
    "/proposal/$quoteVersionId",
    "quotes",
    "proposal",
  ),
  contributionRoute("(auth)/route.tsx", "/(auth)", "localAuth", "layout"),
  contributionRoute(
    "(auth)/accept-invitation.tsx",
    "/(auth)/accept-invitation",
    "localAuth",
    "acceptInvitation",
  ),
  contributionRoute(
    "(auth)/accept-invite.tsx",
    "/(auth)/accept-invite",
    "localAuth",
    "acceptInvite",
  ),
  contributionRoute(
    "(auth)/forgot-password.tsx",
    "/(auth)/forgot-password",
    "localAuth",
    "forgotPassword",
  ),
  contributionRoute("(auth)/onboarding.tsx", "/(auth)/onboarding", "localAuth", "onboarding"),
  contributionRoute(
    "(auth)/reset-password.tsx",
    "/(auth)/reset-password",
    "localAuth",
    "resetPassword",
  ),
  contributionRoute("(auth)/sign-in.tsx", "/(auth)/sign-in", "localAuth", "signIn"),
  contributionRoute("(auth)/sign-up.tsx", "/(auth)/sign-up", "localAuth", "signUp"),
  contributionRoute("(auth)/verify-email.tsx", "/(auth)/verify-email", "localAuth", "verifyEmail"),
  contributionRoute("(storefront)/route.tsx", "/(storefront)", "storefront", "layout"),
  contributionRoute("(storefront)/shop.tsx", "/(storefront)/shop", "storefront", "shop"),
  contributionRoute(
    "(storefront)/shop_.account.tsx",
    "/(storefront)/shop_/account",
    "storefront",
    "account",
  ),
  contributionRoute(
    "(storefront)/shop_.account.sign-in.tsx",
    "/(storefront)/shop_/account/sign-in",
    "storefront",
    "accountSignIn",
  ),
  contributionRoute(
    "(storefront)/shop_.account.sign-up.tsx",
    "/(storefront)/shop_/account/sign-up",
    "storefront",
    "accountSignUp",
  ),
  contributionRoute(
    "(storefront)/shop_.account.verify-email.tsx",
    "/(storefront)/shop_/account/verify-email",
    "storefront",
    "accountVerifyEmail",
  ),
  contributionRoute(
    "(storefront)/shop_.book.$entityModule.$entityId.tsx",
    "/(storefront)/shop_/book/$entityModule/$entityId",
    "storefront",
    "booking",
  ),
  contributionRoute(
    "(storefront)/shop_.composer.tsx",
    "/(storefront)/shop_/composer",
    "storefront",
    "composer",
  ),
  contributionRoute(
    "(storefront)/shop_.confirmation.$bookingId.tsx",
    "/(storefront)/shop_/confirmation/$bookingId",
    "storefront",
    "confirmation",
  ),
  contributionRoute(
    "(storefront)/shop_.products.$entityModule.$entityId.tsx",
    "/(storefront)/shop_/products/$entityModule/$entityId",
    "storefront",
    "productDetail",
  ),
  {
    path: "_workspace/route.tsx",
    source: `
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { operatorFrontend } from "../_lib/operator-frontend"

const workspace = operatorFrontend.workspace

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
