import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin/extensions"
import { Building2, Globe, Store, Users } from "lucide-react"
import { authTeamSetupMessageDefinitions } from "./i18n/setup.js"

/** Selected-graph team settings contribution owned by Auth React. */
export function createSelectedAuthTeamAdminExtension(
  context?: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  const label = context?.navMessages.team ?? authTeamSetupMessageDefinitions.en.navigationLabel
  return defineAdminExtension({
    id: "auth-team",
    settingsPages: [
      {
        id: "team",
        path: "/team",
        title: label,
        label,
        icon: Users,
        group: "general",
        order: 20,
        page: () =>
          import("./components/team-management-page.js").then((module) =>
            adminRoutePageModule(module.TeamManagementPage),
          ),
        routeMessagesProvider: () =>
          import("./i18n/index.js").then((module) => ({ default: module.AuthUiMessagesProvider })),
      },
    ],
    setupSteps: [
      {
        id: "@voyant-travel/auth#setup.team",
        order: 60,
        skippable: true,
        href: "/settings/team",
        messages: authTeamSetupMessageDefinitions,
        isComplete: hasAdditionalTeamMember,
      },
    ],
  })
}

/** Selected-graph customer business-account operations owned by Auth React. */
export function createSelectedCustomerBusinessAccountsAdminExtension(
  context?: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  const label = context?.navMessages.businessAccounts ?? "Business accounts"
  return defineAdminExtension({
    id: "customer-business-accounts",
    navigation: [
      {
        order: 45,
        items: [
          {
            id: "customer-business-accounts",
            title: label,
            url: "/business-accounts",
            icon: Building2,
          },
        ],
      },
    ],
    routes: [
      {
        id: "customer-business-accounts",
        path: "/business-accounts",
        title: label,
        ssr: "data-only",
        page: () =>
          import("./components/customer-business-accounts-page.js").then((module) =>
            adminRoutePageModule(module.CustomerBusinessAccountsPage),
          ),
        loader: loadCustomerBusinessAccounts,
        routeMessagesProvider: () =>
          import("./i18n/index.js").then((module) => ({
            default: module.AuthUiMessagesProvider,
          })),
      },
    ],
  })
}

/**
 * Selected-graph "Storefronts" admin surface owned by Auth React.
 *
 * The former top-level "Sites" surface is reparented here as a sub-view of
 * Storefronts: the nav entry and route live under Storefronts, and a
 * `cloud_site` storefront's hosting/deployment aspect is a managed-only
 * capability that plugs into the reparented `/storefronts/sites` route.
 */
export function createSelectedStorefrontAdminExtension(
  context?: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  const label = context?.navMessages.storefronts ?? "Storefronts"
  const sitesLabel = context?.navMessages.storefrontSites ?? "Sites"
  const routeMessagesProvider = () =>
    import("./i18n/index.js").then((module) => ({ default: module.AuthUiMessagesProvider }))
  return defineAdminExtension({
    id: "storefronts",
    navigation: [
      {
        order: 46,
        items: [
          {
            id: "storefronts",
            title: label,
            url: "/storefronts",
            icon: Store,
            items: [
              { id: "storefronts-all", title: label, url: "/storefronts", icon: Store },
              // Reparented Sites entry (was the top-level "Sites" nav item).
              {
                id: "storefronts-sites",
                title: sitesLabel,
                url: "/storefronts/sites",
                icon: Globe,
              },
            ],
          },
        ],
      },
    ],
    routes: [
      {
        id: "storefronts",
        path: "/storefronts",
        title: label,
        ssr: "data-only",
        page: () =>
          import("./components/storefronts-page.js").then((module) =>
            adminRoutePageModule(module.StorefrontsPage),
          ),
        loader: loadStorefronts,
        routeMessagesProvider,
      },
      {
        // Reparented Sites route: the managed sites surface plugs in here.
        id: "storefront-sites",
        path: "/storefronts/sites",
        title: sitesLabel,
        ssr: "data-only",
        page: () =>
          import("./components/storefront-sites-page.js").then((module) =>
            adminRoutePageModule(module.StorefrontSitesPage),
          ),
        routeMessagesProvider,
      },
    ],
  })
}

async function loadStorefronts({ queryClient, runtime }: AdminRouteLoaderContext): Promise<void> {
  const {
    createStorefrontsAdminApi,
    storefrontCapabilitiesQueryOptions,
    storefrontListQueryOptions,
  } = await import("./storefronts-admin-api.js")
  const api = createStorefrontsAdminApi(runtime.baseUrl, runtime.fetcher ?? fetch)
  await Promise.all([
    queryClient.prefetchQuery(storefrontCapabilitiesQueryOptions(api)),
    queryClient.prefetchQuery(storefrontListQueryOptions(api)),
  ])
}

async function loadCustomerBusinessAccounts({
  queryClient,
  runtime,
}: AdminRouteLoaderContext): Promise<void> {
  const {
    createCustomerBusinessAccountsAdminApi,
    customerBusinessAccountCapabilitiesQueryOptions,
    customerBusinessAccountRequestsQueryOptions,
  } = await import("./customer-business-accounts-admin-api.js")
  const api = createCustomerBusinessAccountsAdminApi(runtime.baseUrl, runtime.fetcher ?? fetch)
  const capabilities = await queryClient.fetchQuery(
    customerBusinessAccountCapabilitiesQueryOptions(api),
  )
  if (capabilities.viewRequests) {
    await queryClient.prefetchQuery(customerBusinessAccountRequestsQueryOptions(api))
  }
}

async function hasAdditionalTeamMember({ runtime }: AdminRouteLoaderContext): Promise<boolean> {
  const fetcher = runtime.fetcher ?? fetch
  const [membersResponse, invitationsResponse] = await Promise.all([
    fetcher(`${runtime.baseUrl}/v1/admin/team/members`),
    fetcher(`${runtime.baseUrl}/v1/admin/team/invitations`),
  ])
  if (!membersResponse.ok || !invitationsResponse.ok) return false
  const members = (await membersResponse.json()) as { data?: unknown[] }
  const invitations = (await invitationsResponse.json()) as { data?: unknown[] }
  return (members.data?.length ?? 0) > 1 || (invitations.data?.length ?? 0) > 0
}
