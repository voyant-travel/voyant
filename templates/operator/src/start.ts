import { createCsrfMiddleware, createStart } from "@tanstack/react-start"

/**
 * Disable server-side execution of route loaders and components by default.
 *
 * Routes opt back into SSR with `ssr: true` or `ssr: "data-only"` and use
 * the SSR-aware `operatorFetcher` from `lib/voyant-fetcher.ts` to forward
 * the incoming request's cookies. The SPA-mode default keeps the rest of
 * the dashboard on the existing client-only path during the gradual SSR
 * rollout.
 */
const csrfMiddleware = createCsrfMiddleware({
  // Only enforce on server function RPC requests — route loaders that opt
  // into SSR don't need this guard (they're not externally callable RPCs).
  filter: (ctx) => ctx.handlerType === "serverFn",
})

export const startInstance = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [csrfMiddleware],
}))
