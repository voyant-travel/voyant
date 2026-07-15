import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
  type SelectedAdminExtensionFactoryContext,
  withAdminRouteMessagesProvider,
} from "@voyant-travel/admin"
import { Tag } from "lucide-react"

export {
  type CreatePromotionsAdminExtensionOptions,
  createPromotionsAdminExtension,
} from "./promotions/admin/index.js"

export interface CreateCommerceAdminExtensionOptions {
  /** Localized nav/page labels. Defaults are the English operator nav labels. */
  labels?: {
    promotions?: string
  }
  /** Nav icon — icon choice stays with the host (e.g. lucide `Tag`). */
  icon?: NavItem["icon"]
  /** Nav ordering past the host's base items. Default 50. */
  order?: number
  /** Mount path inside the admin workspace. Default `/promotions`. */
  path?: string
}

export function createCommerceAdminExtension(
  options: CreateCommerceAdminExtensionOptions = {},
): AdminExtension {
  const { labels = {}, icon, order = 50, path = "/promotions" } = options
  const { promotions = "Promotions" } = labels

  return defineAdminExtension({
    id: "commerce",
    navigation: [
      {
        order,
        items: [{ id: "promotions", title: promotions, url: path, icon }],
      },
    ],
    routes: [
      {
        id: "promotions-index",
        path,
        title: promotions,
        ssr: "data-only",
        page: () =>
          import("./promotions/promotions-page.js").then((module) =>
            adminRoutePageModule(module.PromotionsPage),
          ),
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { loadPromotionsPage } = await import("./promotions/promotions-page.js")
          return loadPromotionsPage(queryClient, {
            baseUrl: runtime.baseUrl,
            fetcher: runtime.fetcher,
          })
        },
      },
    ],
  })
}

export function createSelectedCommerceAdminExtension({
  navMessages,
}: SelectedAdminExtensionFactoryContext): AdminExtension {
  const promotionsLabel = navMessages.promotions ?? "Promotions"
  return withAdminRouteMessagesProvider(
    createCommerceAdminExtension({
      labels: { promotions: promotionsLabel },
      icon: Tag,
      order: 50,
    }),
    () =>
      import("./promotions/i18n/index.js").then((module) => ({
        default: module.PromotionsUiMessagesProvider,
      })),
  )
}
