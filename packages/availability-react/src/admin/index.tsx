import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyantjs/admin"
// Type-only: binds the bookings-ui `AdminDestinations` augmentation
// (`booking.detail`, `product.detail`, `availabilitySlot.detail`, ...) into
// this program — the slot detail host's booking/product quick-view sheets
// navigate through those shared keys, and `booking.detail`'s shape carries
// bookings-ui's own tab union, so re-declaring it here could not stay
// shape-identical. `availabilitySlot.detail` is bookings-ui-declared too
// (its booking items link to slots), so this package consumes rather than
// re-declares it.
import type {} from "@voyantjs/bookings-react/admin"
// Lean static only: the client module (fetcher). The page-data helper pulls
// the availability query options (client + response schemas), so the index
// loader resolves it via dynamic import instead of pinning it into the
// workspace-chrome chunk that evaluates this factory.
import { defaultFetcher } from "../client.js"
import {
  AvailabilityPageSkeleton,
  AvailabilityRuleDetailSkeleton,
  AvailabilitySlotDetailSkeleton,
  AvailabilityStartTimeDetailSkeleton,
} from "../components/availability-skeletons.js"

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
//
// Endgame rule (packaged-admin RFC §4.8): this barrel re-exports NO page,
// host or panel component values — it is evaluated with the workspace
// chrome, so a static re-export would pin the heavy availability modules
// into the entry chunk. Consumers import them from their specific modules
// (`@voyantjs/availability-react/admin/option-resource-templates-panel`,
// ...); only their TYPES re-export here.
export type { OptionResourceTemplatesPanelProps } from "./option-resource-templates-panel.js"
export type { AvailabilityRuleDetailHostProps } from "./rule-detail-host.js"
export type { AvailabilitySlotDetailHostProps } from "./slot-detail-host.js"
export type { AvailabilityStartTimeDetailHostProps } from "./start-time-detail-host.js"

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
 * ROUTES: contributions carry the FULL route implementation (packaged-admin
 * RFC §4.2/§4.8) — lazy `page` module loaders, data loaders fed by the
 * host-supplied {@link AdminRouteLoaderContext} (QueryClient + runtime +
 * params), per-route SSR mode, and pending skeletons. Hosts bind them into
 * their code-assembled admin route tree; no per-route host files needed.
 * The pages stay code-split because each contribution's `page` dynamically
 * imports the specific host/page module — never the admin barrel — so the
 * heavy page chunks load on navigation, not with workspace chrome.
 * {@link AvailabilityIndexHost} (the slots list + calendar landing page,
 * with bulk update/delete running through the typed batch mutation hooks in
 * `@voyantjs/availability-react`) mounts as a zero-prop page; the detail
 * hosts {@link AvailabilitySlotDetailHost},
 * {@link AvailabilityRuleDetailHost} and
 * {@link AvailabilityStartTimeDetailHost} read their record id from
 * `AdminRoutePageProps` via the default-exported wrappers in `./pages/`.
 * The index host's SSR loader binding is no longer app-side:
 * {@link ensureAvailabilityPageData} runs in the contribution's own loader
 * against the host runtime's cookie-forwarding fetcher. The pages keep
 * their filter state component-local, so there are no URL search contracts,
 * and every cross-route link resolves through the semantic destinations
 * declared above.
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
        ssr: "data-only",
        page: () =>
          import("./availability-index-host.js").then((module) =>
            adminRoutePageModule(module.AvailabilityIndexHost),
          ),
        // Awaits only what the slots tab + the products picker need for
        // first paint; the slot dialog's rules/start-times dimensions
        // prefetch in the background. Dynamic import on purpose: the helper
        // pulls the availability query options, and a static import here
        // would pin them into the workspace-chrome chunk.
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { ensureAvailabilityPageData } = await import("./availability-page-data.js")
          return ensureAvailabilityPageData(queryClient, loaderClient(runtime))
        },
        pendingComponent: AvailabilityPageSkeleton,
      },
      {
        id: "availability-slot-detail",
        path: `${basePath}/$id`,
        title: availability,
        page: () => import("./pages/availability-slot-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          // Dynamic import on purpose: the loader helper lives in the slot
          // detail page module, and a static import here would pin that
          // module into the host's workspace-chrome chunk, defeating the
          // route's code-split. The loader and the page resolve the same
          // chunk, fetched once.
          const { loadAvailabilitySlotDetailPage } = await import(
            "../components/availability-slot-detail-page.js"
          )
          return loadAvailabilitySlotDetailPage(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: AvailabilitySlotDetailSkeleton,
      },
      {
        id: "availability-rule-detail",
        path: `${basePath}/rules/$id`,
        title: availability,
        page: () => import("./pages/availability-rule-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          // Dynamic import on purpose — see the slot detail loader above.
          const { loadAvailabilityRuleDetailPage } = await import(
            "../components/availability-rule-detail-page.js"
          )
          return loadAvailabilityRuleDetailPage(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: AvailabilityRuleDetailSkeleton,
      },
      {
        id: "availability-start-time-detail",
        path: `${basePath}/start-times/$id`,
        title: availability,
        page: () => import("./pages/availability-start-time-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          // Dynamic import on purpose — see the slot detail loader above.
          const { loadAvailabilityStartTimeDetailPage } = await import(
            "../components/availability-start-time-detail-page.js"
          )
          return loadAvailabilityStartTimeDetailPage(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: AvailabilityStartTimeDetailSkeleton,
      },
    ],
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the availability loaders take.
 *
 * Note: the operator's detail route files built this client with the
 * package `defaultFetcher` (a plain `credentials: "include"` fetch); the
 * contribution uses the host runtime's cookie-forwarding fetcher instead,
 * so detail SSR prefetches authenticate — an intentional improvement.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
