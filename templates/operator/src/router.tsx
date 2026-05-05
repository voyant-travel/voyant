import { QueryClient } from "@tanstack/react-query"
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
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: DefaultNotFound,
    // SPA-mode via defaultSsr: false in src/start.ts — loaders run on the
    // client with browser cookies. No need to dehydrate/hydrate queryClient
    // because the server never populates it.
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
}
