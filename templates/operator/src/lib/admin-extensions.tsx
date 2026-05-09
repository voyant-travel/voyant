import {
  type AdminExtension,
  createAdminExtensionRegistry,
  defineAdminExtension,
} from "@voyantjs/admin"
import { Tag } from "lucide-react"

/**
 * Operator admin contributions composed through the shared admin runtime.
 *
 * Keep this explicit and source-controlled so the template still owns shell
 * composition while the extension seam stays typed and framework-level.
 *
 * Widget slots currently exposed by the operator template:
 * - `dashboard.header`
 * - `dashboard.after-kpis`
 * - `dashboard.footer`
 * - `booking.details.header`
 * - `booking.details.after-summary`
 * - `invoice.details.header`
 * - `invoice.details.after-summary`
 */

/**
 * Promotions extension — registers the sidebar nav entry pointing to
 * `/promotions`. The route composes package-owned React/UI surfaces from
 * `@voyantjs/promotions-react` and `@voyantjs/promotions-ui`.
 *
 * Per docs/architecture/promotions-architecture.md PR5.
 */
const promotionsExtension = defineAdminExtension({
  id: "promotions",
  navigation: [
    {
      // Order > 0 nudges this past the default admin items so it lands
      // alongside the operator's commercial tools.
      order: 50,
      items: [
        {
          id: "promotions",
          title: "Promotions",
          url: "/promotions",
          icon: Tag,
        },
      ],
    },
  ],
})

export const adminExtensions: ReadonlyArray<AdminExtension> =
  createAdminExtensionRegistry(promotionsExtension)
