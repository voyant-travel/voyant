import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"
// Type-only: binds the bookings-ui `AdminDestinations` augmentation
// (`booking.detail`, `product.detail`, `availabilitySlot.detail`, ...) into
// this program — the slot detail host's booking/product quick-view sheets
// navigate through those shared keys, and `booking.detail`'s shape carries
// bookings-ui's own tab union, so re-declaring it here could not stay
// shape-identical. `availabilitySlot.detail` is bookings-ui-declared too
// (its booking items link to slots), so this package consumes rather than
// re-declares it.
import type {} from "@voyantjs/bookings-react/admin"

/**
 * Semantic destinations the availability admin surfaces navigate to
 * (packaged-admin RFC §4.7). Keys shared with other domains
 * (`availabilitySlot.detail`, `booking.detail`, `product.detail`) come from
 * the bookings-ui augmentation bound above; declared here are the
 * availability-owned targets the packaged pages and breadcrumbs resolve
 * through `useAdminHref`/`useAdminNavigate`.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The availability landing page (slots list + calendar). */
    "availabilitySlot.list": Record<string, never>
    /** An availability start time's detail page. */
    "availabilityStartTime.detail": { startTimeId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the operator-grade
// availability pages bound to their data wiring + semantic-destination
// navigation. Host route files only bind route params onto these.
export { AvailabilityIndexHost } from "./availability-index-host.js"
export { ensureAvailabilityPageData } from "./availability-page-data.js"
export {
  OptionResourceTemplatesPanel,
  type OptionResourceTemplatesPanelProps,
} from "./option-resource-templates-panel.js"
export {
  AvailabilityRuleDetailHost,
  type AvailabilityRuleDetailHostProps,
} from "./rule-detail-host.js"
export {
  AvailabilitySlotDetailHost,
  type AvailabilitySlotDetailHostProps,
} from "./slot-detail-host.js"
export {
  AvailabilityStartTimeDetailHost,
  type AvailabilityStartTimeDetailHostProps,
} from "./start-time-detail-host.js"

export interface CreateAvailabilityAdminExtensionOptions {
  /** Mount path of the availability pages inside the admin workspace. Default `/availability`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    availability?: string
  }
}

/**
 * The availability admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Availability nav item is part of the
 * BASE operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing a nav entry here would duplicate it.
 * If the base nav ever drops the availability item, this extension is where
 * the entry moves.
 *
 * ROUTES: contributions are metadata only — the availability pages keep
 * their filter state component-local, so there are no URL search contracts.
 * The PAGES are package-owned: {@link AvailabilityIndexHost} (the slots
 * list + calendar landing page, with bulk update/delete running through
 * the typed batch mutation hooks in `@voyantjs/availability-react`) plus
 * the detail hosts {@link AvailabilitySlotDetailHost},
 * {@link AvailabilityRuleDetailHost} and
 * {@link AvailabilityStartTimeDetailHost} bind the operator-grade pages to
 * their data wiring (the shared availability provider context) and resolve
 * every cross-route link through the semantic destinations declared above.
 * `component:` is intentionally NOT attached to these contributions: the
 * contribution contract renders zero-prop pages (route components read
 * params via the router, per RFC §4.2), while the detail hosts take the
 * record id as a prop — host route files stay the thin binding layer
 * (`Route.useParams()` → host props) until the §4.2 code-based route
 * assembly lands. The index host's SSR loader binding stays app-side
 * ({@link ensureAvailabilityPageData} takes the app's cookie-forwarding
 * client), per the packaged-host recipe.
 *
 * WIDGETS: none. {@link OptionResourceTemplatesPanel} (the per-option
 * resource templates editor the product editor embeds) ships from this
 * entry as a directly importable component — the products admin host owns
 * where it mounts.
 */
export function createAvailabilityAdminExtension(
  options: CreateAvailabilityAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/availability", labels = {} } = options
  const { availability = "Availability" } = labels

  return defineAdminExtension({
    id: "availability",
    routes: [
      {
        id: "availability-index",
        path: basePath,
        title: availability,
      },
      {
        id: "availability-slot-detail",
        path: `${basePath}/$id`,
        title: availability,
      },
      {
        id: "availability-rule-detail",
        path: `${basePath}/rules/$id`,
        title: availability,
      },
      {
        id: "availability-start-time-detail",
        path: `${basePath}/start-times/$id`,
        title: availability,
      },
    ],
  })
}
