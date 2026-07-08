import { type ApiDispatch, createWorkerFetch, lazySsr } from "@voyant-travel/runtime"

/**
 * The managed-operator reference has NO API of its own — the managed admin API
 * is a separate process (voyant#2987). This host only needs enough of the auth
 * surface for the workspace guard to resolve a user and render the dashboard, so
 * the API branch is a tiny stub dispatch:
 *
 *   - `/api/auth/me`              → a fake current user (guard resolves → SSR the shell)
 *   - `/api/auth/bootstrap-status`→ `{ hasUsers: true, authMode: "local" }`
 *   - anything else under `/api/*`→ 404
 *
 * The workspace guard fetches `${getManagedProfileAdminApiUrl()}/auth/me`
 * (= `/api/auth/me`) via the packaged managed-profile fetcher, so these two
 * stubs are all it takes to reach the authenticated dashboard.
 */
const API_PREFIX = "/api"

const STUB_USER = {
  id: "usr_managed_reference",
  firstName: "Managed",
  lastName: "Operator",
  email: "operator@managed.local",
  locale: "en",
  timeZone: "UTC",
} as const

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function matchesApiPrefix(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)
}

const stubApiDispatch: ApiDispatch<AppBindings, ExecutionContext> = {
  isApiRequest: (pathname) => matchesApiPrefix(pathname),
  isAuthRequest: (pathname) => pathname.startsWith(`${API_PREFIX}/auth`),
  toAppRequest: (request) => request,
  dispatch: (request) => {
    const { pathname } = new URL(request.url)
    if (pathname === `${API_PREFIX}/auth/me`) {
      return Promise.resolve(jsonResponse(STUB_USER))
    }
    if (pathname === `${API_PREFIX}/auth/bootstrap-status`) {
      return Promise.resolve(jsonResponse({ hasUsers: true, authMode: "local" }))
    }
    return Promise.resolve(jsonResponse({ error: "not_found", path: pathname }, 404))
  },
}

// SSR is loaded lazily behind the non-API branch so the React + react-dom/server
// graph (~2.2 MB) is imported on first render rather than at boot. `src/server.ts`
// wires this `fetch` into the Node runtime via `createNodeServer`.
export const fetch = createWorkerFetch<AppBindings, ExecutionContext>({
  api: stubApiDispatch,
  ssr: lazySsr(() => import("./ssr-handler").then((mod) => mod.handleSsrRequest)),
})

/** No scheduled work in this reference — accepted for `createNodeServer` parity. */
export async function scheduled(
  _event: ScheduledController,
  _env: AppBindings,
  _ctx: ExecutionContext,
): Promise<void> {}
