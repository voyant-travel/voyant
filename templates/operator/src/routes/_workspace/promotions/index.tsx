import { createFileRoute } from "@tanstack/react-router"
import { loadPromotionsPage, PromotionsPage } from "@voyantjs/promotions-ui/admin"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered promotions admin page (packaged-admin
// RFC Phase 2). Page, loader, and SSR mode are package-owned; this file only
// binds them to the file-based route tree with the app's runtime.
// - `fetcher: operatorFetcher` forwards the request cookie on SSR (the
//   default fetcher would 401 on direct loads).
// - No per-route provider: the page's API context comes from the shell's
//   VoyantReactProvider (same context VoyantPromotionsProvider aliases),
//   already configured with this baseUrl + fetcher.
export const Route = createFileRoute("/_workspace/promotions/")({
  ssr: "data-only",
  loader: ({ context }) =>
    loadPromotionsPage(context.queryClient, { baseUrl: getApiUrl(), fetcher: operatorFetcher }),
  component: PromotionsPage,
})
