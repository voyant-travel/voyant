import { createManagedProfileAdminSsrHandler } from "@voyant-travel/admin-host/ssr"

/**
 * The TanStack Start SSR handler, isolated in its own module so `entry.ts` can
 * dynamic-`import()` it behind the non-API branch (via `lazySsr`). This keeps
 * `@tanstack/react-start/server` — which statically pulls React and
 * `react-dom/server` (~2.2 MB) — OUT of the startup graph. API-only isolates
 * (including `/api/health`) never load the React SSR graph, mirroring the lazy
 * `import("./api/app")` on the API side.
 *
 * The `createStartHandler` seam itself lives in `@voyant-travel/admin-host/ssr`
 * so admin hosts don't reimplement it; it still relies on this app's TanStack
 * Start build to provide the router.
 *
 * See docs/architecture/deployment-targets.md.
 */
export const handleSsrRequest = createManagedProfileAdminSsrHandler<AppBindings>()
