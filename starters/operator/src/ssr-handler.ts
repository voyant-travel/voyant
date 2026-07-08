import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { withActiveRouteSsrManifest } from "@voyant-travel/runtime"

/**
 * The TanStack Start SSR handler, isolated in its own module so `entry.ts` can
 * dynamic-`import()` it behind the non-API branch (via `lazySsr`). This keeps
 * `@tanstack/react-start/server` — which statically pulls React and
 * `react-dom/server` (~2.2 MB) — OUT of the Worker's startup graph. API-only
 * isolates (including `/api/health`) never load the React SSR graph, mirroring
 * the lazy `import("./api/app")` on the API side.
 *
 * See docs/architecture/deployment-targets.md.
 */
const startHandler = createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))

export function handleSsrRequest(
  request: Request,
  env: AppBindings,
  _ctx: ExecutionContext,
): Response | Promise<Response> {
  return startHandler(request, { context: { env } } as never)
}
