import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin"
// Lean static only: the shared fetcher fallback. The page-data helpers
// resolve via dynamic import inside the loaders so the REST query options stay
// out of the workspace-chrome chunk that evaluates this factory.
import { defaultFetcher } from "@voyant-travel/react"
import { FileText } from "lucide-react"

/**
 * Semantic destinations the quotes admin surfaces navigate to (packaged-admin
 * RFC §4.7). The board opens a quote's detail; the detail page links back to
 * the board — instead of importing a host route tree they resolve these keys
 * through `useAdminNavigate` from `@voyant-travel/admin`. Both are route-backed
 * (pure path interpolation), so the host's resolvers are generated.
 */
declare module "@voyant-travel/admin" {
  interface AdminDestinations {
    /** The quotes board (landing) page. */
    "quote.list": Record<string, never>
    /** A quote's detail page, where its versions live. */
    "quote.detail": { quoteId: string }
  }
}

// Endgame rule (packaged-admin RFC §4.8): this barrel re-exports NO page or
// host component values — it is evaluated with the workspace chrome, so a
// static host re-export would pin the Quotes page modules (board, dialogs,
// detail table) into the entry chunk. Hosts import from their specific
// modules; only the lightweight query keys re-export here.
export { quotesQueryKeys } from "../query-keys.js"

export interface CreateQuotesAdminExtensionOptions {
  /** Mount path of the quotes pages inside the admin workspace. Default `/quotes`. */
  basePath?: string
  /** Localized nav/page labels. Defaults are the English operator nav labels. */
  labels?: {
    quotes?: string
  }
  /** Nav icon — icon choice stays with the host (e.g. lucide `FileText`). */
  icon?: NavItem["icon"]
}

/**
 * The quotes admin contribution (packaged-admin RFC Phase 3,
 * `@voyant-travel/<domain>-react/admin` convention).
 *
 * NAVIGATION: package-delivered. The Quotes item is NOT part of the BASE
 * operator navigation (`createOperatorAdminNavigation` in
 * `@voyant-travel/admin`), so the extension contributes it — spliced directly
 * after Bookings via `insertAfter` because both belong to the
 * quote → accept → book lifecycle. The icon stays a host choice.
 *
 * ROUTES: two contributions carry the FULL route implementation — the board
 * (landing) at `basePath`, where operators manage pipelines/stages and create
 * quotes, and a quote detail at `basePath/$id`, where that quote's VERSIONS
 * live (listed inline, created in context). Versions are never a top-level
 * surface: they are revisions of a quote. Both pages keep their filter/state
 * local (no URL search contract); cross-route links resolve through the
 * semantic destinations declared above.
 *
 * WIDGETS: none contributed and no slots exposed yet.
 */
export function createQuotesAdminExtension(
  options: CreateQuotesAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/quotes", labels = {}, icon } = options
  const { quotes = "Quotes" } = labels

  return defineAdminExtension({
    id: "quotes",
    navigation: [
      {
        insertAfter: "bookings",
        items: [{ id: "quotes", title: quotes, url: basePath, icon }],
      },
    ],
    routes: [
      {
        id: "quotes-index",
        path: basePath,
        title: quotes,
        destination: "quote.list",
        ssr: "data-only",
        routeMessagesProvider: quotesRouteMessagesProvider,
        page: () =>
          import("./quotes-board-host.js").then((module) =>
            adminRoutePageModule(module.QuotesBoardHost),
          ),
        // Dynamic import on purpose: the helper pulls the REST query options,
        // and a static import here would pin them into the workspace-chrome
        // chunk that evaluates this factory.
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { getPipelinesQueryOptions } = await import("../query-options.js")
          return queryClient.ensureQueryData(
            getPipelinesQueryOptions(loaderClient(runtime), { entityType: "quote", limit: 50 }),
          )
        },
      },
      {
        id: "quotes-detail",
        path: `${basePath}/$id`,
        title: quotes,
        destination: "quote.detail",
        destinationParams: { id: "quoteId" },
        ssr: "data-only",
        routeMessagesProvider: quotesRouteMessagesProvider,
        page: () => import("./pages/quote-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const { getQuoteQueryOptions } = await import("../query-options.js")
          return queryClient.ensureQueryData(getQuoteQueryOptions(loaderClient(runtime), id))
        },
      },
    ],
  })
}

/** Selected-graph adapter owning the standard Operator copy key and icon. */
export function createSelectedQuotesAdminExtension(
  { navMessages }: SelectedAdminExtensionFactoryContext = { navMessages: {} },
): AdminExtension {
  return createQuotesAdminExtension({
    labels: { quotes: navMessages.quotes ?? "Quotes" },
    icon: FileText,
  })
}

function quotesRouteMessagesProvider() {
  return import("../i18n/index.js").then((module) => ({ default: module.CrmUiMessagesProvider }))
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the query options take — SSR loaders
 * run with the host runtime's cookie-forwarding fetcher.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
