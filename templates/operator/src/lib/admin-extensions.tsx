import {
  type AdminExtension,
  createAdminExtensionRegistry,
  defineAdminExtension,
} from "@voyantjs/admin"
import { Route, ScrollText, Tag } from "lucide-react"

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

const travelComposerExtension = defineAdminExtension({
  id: "travel-composer",
  navigation: [
    {
      // Splice Trips in right after Bookings — both belong to the booking
      // lifecycle. `insertAfter` keeps the contribution shape; the resolver
      // splices in place rather than appending at the end.
      insertAfter: "bookings",
      items: [
        {
          id: "travel-composer",
          title: "Trips",
          url: "/trips",
          icon: Route,
          items: [
            {
              id: "travel-composer-list",
              title: "All trips",
              url: "/trips",
            },
            {
              id: "travel-composer-new",
              title: "New trip",
              url: "/trips/new",
            },
          ],
        },
      ],
    },
  ],
})

const actionLedgerExtension = defineAdminExtension({
  id: "action-ledger",
  navigation: [
    {
      order: 60,
      items: [
        {
          id: "action-ledger",
          title: "Logs",
          url: "/action-ledger",
          icon: ScrollText,
        },
      ],
    },
  ],
})

export const adminExtensions: ReadonlyArray<AdminExtension> = createAdminExtensionRegistry(
  promotionsExtension,
  travelComposerExtension,
  actionLedgerExtension,
)
