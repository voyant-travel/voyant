import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  composeAdminRouteMessagesProviders,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
  withAdminRouteMessagesProvider,
} from "@voyant-travel/admin"

import {
  type CreateSuppliersAdminExtensionOptions,
  createSuppliersAdminExtension,
} from "../suppliers/admin/index.js"
import { SupplierDetailSkeleton } from "../suppliers/admin/supplier-detail-skeleton.js"
import { SuppliersListSkeleton } from "../suppliers/admin/suppliers-list-skeleton.js"
import { defaultFetcher } from "../suppliers/client.js"

export { type CreateSuppliersAdminExtensionOptions, createSuppliersAdminExtension }

declare module "@voyant-travel/admin" {
  interface AdminDestinations {
    /** The suppliers list page. */
    "supplier.list": Record<string, never>
    /** A supplier's detail page. */
    "supplier.detail": { supplierId: string }
  }
}

export interface CreateDistributionAdminExtensionOptions {
  /** Mount path of the channel-sync page inside the admin workspace. Default `/channel-sync`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    channelSync?: string
    suppliers?: string
  }
  suppliers?: Omit<CreateSuppliersAdminExtensionOptions, "labels">
}

/**
 * The distribution admin contribution owns channel-side sync plus supplier
 * counterparty pages. Supplier pages stay under `/suppliers`, but the v1
 * admin entry and package surface are distribution-owned.
 */
export function createDistributionAdminExtension(
  options: CreateDistributionAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/channel-sync", labels = {}, suppliers = {} } = options
  const { basePath: suppliersBasePath = "/suppliers" } = suppliers
  const { channelSync = "Distribution", suppliers: suppliersLabel = "Suppliers" } = labels

  return defineAdminExtension({
    id: "distribution",
    routes: [
      {
        id: "distribution-channel-sync",
        path: basePath,
        title: channelSync,
        page: () =>
          import("../components/channel-sync-page.js").then((module) =>
            adminRoutePageModule(module.ChannelSyncPage),
          ),
      },
      {
        id: "suppliers-index",
        path: suppliersBasePath,
        title: suppliersLabel,
        destination: "supplier.list",
        ssr: "data-only",
        page: () =>
          import("../suppliers/admin/suppliers-host.js").then((module) =>
            adminRoutePageModule(module.SuppliersHost),
          ),
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { getSuppliersQueryOptions } = await import("../suppliers/query-options.js")
          return queryClient.ensureQueryData(getSuppliersQueryOptions(loaderClient(runtime)))
        },
        pendingComponent: SuppliersListSkeleton,
      },
      {
        id: "suppliers-detail",
        path: `${suppliersBasePath}/$id`,
        title: suppliersLabel,
        destination: "supplier.detail",
        destinationParams: { id: "supplierId" },
        page: () => import("../suppliers/admin/pages/supplier-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const {
            getSupplierNotesQueryOptions,
            getSupplierQueryOptions,
            getSupplierServiceRatesQueryOptions,
            getSupplierServicesQueryOptions,
          } = await import("../suppliers/query-options.js")
          const client = loaderClient(runtime)
          const servicesData = await queryClient.ensureQueryData(
            getSupplierServicesQueryOptions(client, id),
          )

          await Promise.all([
            queryClient.ensureQueryData(getSupplierQueryOptions(client, id)),
            queryClient.ensureQueryData(getSupplierNotesQueryOptions(client, id)),
            ...servicesData.data.map((service) =>
              queryClient.ensureQueryData(
                getSupplierServiceRatesQueryOptions(client, id, service.id),
              ),
            ),
          ])
        },
        pendingComponent: SupplierDetailSkeleton,
      },
    ],
  })
}

function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}

const distributionRouteMessagesProvider = composeAdminRouteMessagesProviders(
  () =>
    import("../i18n/index.js").then((module) => ({
      default: module.DistributionUiMessagesProvider,
    })),
  () =>
    import("../suppliers/i18n/index.js").then((module) => ({
      default: module.SuppliersUiMessagesProvider,
    })),
)

export function createSelectedDistributionAdminExtension({
  navMessages,
}: SelectedAdminExtensionFactoryContext): AdminExtension {
  return withAdminRouteMessagesProvider(
    createDistributionAdminExtension({
      labels: {
        channelSync: navMessages.channelSync,
        suppliers: navMessages.suppliers,
      },
    }),
    distributionRouteMessagesProvider,
  )
}
