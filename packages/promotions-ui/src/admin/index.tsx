import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  defineAdminExtension,
  type NavItem,
} from "@voyantjs/admin"

import { loadPromotionsPage, PromotionsPage } from "../promotions-page.js"

export { PromotionDialog, type PromotionDialogProps } from "../promotion-dialog.js"
export {
  loadPromotionsPage,
  type PromotionDialogRenderProps,
  PromotionsPage,
  type PromotionsPageProps,
} from "../promotions-page.js"

export interface CreatePromotionsAdminExtensionOptions {
  /** Localized nav/page label. Defaults to "Promotions". */
  label?: string
  /** Nav icon — icon choice stays with the host (e.g. lucide `Tag`). */
  icon?: NavItem["icon"]
  /** Nav ordering past the host's base items. Default 50. */
  order?: number
  /** Mount path inside the admin workspace. Default `/promotions`. */
  path?: string
}

/**
 * The promotions admin contribution — nav entry plus the full route
 * implementation (page component, loader, SSR mode), per the packaged-admin
 * RFC Phase 2 (`@voyantjs/<domain>-ui/admin` convention). Hosts register the
 * extension for navigation and mount the route fields on their router.
 */
export function createPromotionsAdminExtension(
  options: CreatePromotionsAdminExtensionOptions = {},
): AdminExtension {
  const { label = "Promotions", icon, order = 50, path = "/promotions" } = options

  return defineAdminExtension({
    id: "promotions",
    navigation: [
      {
        order,
        items: [{ id: "promotions", title: label, url: path, icon }],
      },
    ],
    routes: [
      {
        id: "promotions-index",
        path,
        title: label,
        ssr: "data-only",
        component: PromotionsPage,
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          loadPromotionsPage(queryClient, {
            baseUrl: runtime.baseUrl,
            fetcher: runtime.fetcher,
          }),
      },
    ],
  })
}
