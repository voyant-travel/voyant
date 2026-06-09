import { type DehydratedState, dehydrate, hydrate, QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter, Link } from "@tanstack/react-router"
import { buttonVariants } from "@voyantjs/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voyantjs/ui/components/empty"
import { SearchX } from "lucide-react"

import { routeTree } from "./routeTree.gen"

export interface RouterContext {
  queryClient: QueryClient
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        // 30s default keeps preloaded data fresh long enough for the hover→
        // click navigation to reuse it. Override per-query for hotter data.
        staleTime: 30_000,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Without this (default 0), preload-on-intent considers data immediately
    // stale, so hover-prefetch re-fires the loader on click. 30s lines up
    // with the QueryClient default above.
    defaultPreloadStaleTime: 30_000,
    defaultNotFoundComponent: DefaultNotFound,
    // QueryClient SSR hydration. While `defaultSsr: false` is set in start.ts
    // this is a no-op — server loaders don't populate the cache. As routes
    // opt into SSR (`ssr: true` or `"data-only"`), the router serializes the
    // server-side QueryClient into the HTML payload and rehydrates it here
    // on the client, so loader-prefetched queries survive across the
    // server→client boundary instead of refetching on mount.
    // Cast around Router's ValidateSerializableInput, which is stricter than
    // DehydratedState's recursive `unknown` slots. Runtime payload is
    // JSON-safe; the official @tanstack/react-router-with-query helper
    // (not installed here) does the same erasure.
    dehydrate: () => ({ queryClient: dehydrate(queryClient) as unknown as object }),
    hydrate: (state: { queryClient: object }) => {
      hydrate(queryClient, state.queryClient as DehydratedState)
    },
  })

  return router
}

function DefaultNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Empty className="max-w-xl border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you requested does not exist or is no longer available.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants({ variant: "default" })}>
            Go to dashboard
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
  /** Ephemeral, per-navigation history state — kept out of the URL. */
  interface HistoryState {
    /** Preview hints for the booking journey when launched from a catalog
     *  detail page (sourced entities aren't in the owned products table). */
    entityName?: string
    entityImageUrl?: string
  }
}
