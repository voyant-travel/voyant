import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
} from "@voyantjs/admin"

export { PromotionDialog, type PromotionDialogProps } from "../promotion-dialog.js"
export {
  loadPromotionsPage,
  type PromotionDialogRenderProps,
  PromotionsPage,
  type PromotionsPageProps,
} from "../promotions-page.js"

export interface CreatePromotionsAdminExtensionOptions {
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

/**
 * The promotions admin contribution — nav entry plus the full route
 * implementation (lazy page module, loader, SSR mode), per the packaged-admin
 * RFC §4.2/§4.8. Hosts register the extension for navigation and bind the
 * route through their code-assembled admin route tree; the page stays
 * code-split because the contribution carries a lazy `page` loader, not a
 * static component reference.
 */
export function createPromotionsAdminExtension(
  options: CreatePromotionsAdminExtensionOptions = {},
): AdminExtension {
  const { labels = {}, icon, order = 50, path = "/promotions" } = options
  const { promotions = "Promotions" } = labels

  return defineAdminExtension({
    id: "promotions",
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
          import("../promotions-page.js").then((module) =>
            adminRoutePageModule(module.PromotionsPage),
          ),
        // Dynamic import on purpose: the loader helper lives in the page
        // module, and a static import here would pin that module into the
        // host's workspace-chrome chunk, defeating the route's code-split.
        // The loader and the page resolve the same chunk, fetched once.
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { loadPromotionsPage } = await import("../promotions-page.js")
          return loadPromotionsPage(queryClient, {
            baseUrl: runtime.baseUrl,
            fetcher: runtime.fetcher,
          })
        },
      },
    ],
  })
}
