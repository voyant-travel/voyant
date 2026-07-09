import {
  type AppLoader,
  createApiDispatch,
  createWorkerFetch,
  lazyApp,
  lazySsr,
} from "@voyant-travel/runtime"

import {
  GENERATED_DEPLOYMENT_GRAPH_MODULE_IDS,
  resolveGeneratedProfileSnapshotPath,
} from "./runtime-entry.generated"

/**
 * The managed-operator reference serves the SSR admin UI AND the REAL managed
 * API in ONE Node process (voyant#3044). `/api/*` is forwarded — prefix-stripped
 * — to the composed managed runtime (voyant#2987); every other route falls
 * through to SSR.
 *
 * The managed runtime is loaded lazily (`lazyApp`) so the full API module graph
 * is imported on the first `/api` request, not at boot. It serves the API from
 * its OWN composed env (built from `process.env` inside
 * `loadManagedProfileRuntime`), so the `env`/`ctx` this dispatch would pass are
 * intentionally ignored — the runtime owns its bindings (DB pool, KV, rate-limit
 * store) end-to-end.
 */

const loadManagedApi: AppLoader<AppBindings, ExecutionContext> = lazyApp(async () => {
  const { loadManagedProfileRuntime } = await import("@voyant-travel/framework/managed-runtime")
  const runtime = await loadManagedProfileRuntime({
    profileSnapshotPath: resolveGeneratedProfileSnapshotPath(),
  })
  // The runtime serves the API from its own composed env (process.env), so we
  // drop the dispatch-supplied env/ctx and defer entirely to `runtime.fetch`.
  return { fetch: (request) => runtime.fetch(request) }
})

/**
 * DEV-ONLY local auth surface.
 *
 * This reference boots in `self-hosted` mode, where the managed runtime mounts
 * NO auth handler — managed profiles authenticate via the Voyant Cloud broker
 * (`VOYANT_ADMIN_AUTH_MODE=voyant-cloud`), and the source-free admin ships no
 * local sign-in page (it redirects to the broker). Without a local auth surface
 * the workspace guard's `/api/auth/me` probe fails and redirects to a
 * non-existent `/sign-in`, so `pnpm start` could never reach the workspace.
 *
 * The dispatch's lean-auth slot serves the two admin-session endpoints the guard
 * needs with a fixed dev user, so the packaged admin is reachable locally. Data
 * routes (`/api/v1/*`) still hit the REAL managed runtime above. A managed-cloud
 * deployment drops this and mounts the runtime's real Cloud-broker auth (which
 * serves the same `/auth/me` + `/auth/bootstrap-status`, added in the framework).
 */
const DEV_USER = {
  id: "usr_managed_reference",
  email: "operator@managed.local",
  firstName: "Managed",
  lastName: "Operator",
  locale: "en",
  timezone: null,
  uiPrefs: null,
  isSuperAdmin: true,
  isSupportUser: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  profilePictureUrl: null,
} as const

function devAuthJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

/**
 * The active module ids for this graph, so the DEV `/auth/bootstrap-status`
 * reports the same module set doctor/build/deploy validated. `graph:check`
 * keeps this generated module in lockstep with `managed-profile.json`.
 */
async function resolveDevActiveModuleIds(): Promise<string[]> {
  return [...GENERATED_DEPLOYMENT_GRAPH_MODULE_IDS]
}

const loadDevAuth: AppLoader<AppBindings, ExecutionContext> = lazyApp(async () => {
  const modules = await resolveDevActiveModuleIds()
  // The dispatch strips `/api` before forwarding, so paths arrive as `/auth/*`.
  return {
    fetch: (request) => {
      const { pathname } = new URL(request.url)
      if (pathname === "/auth/me") return devAuthJson(DEV_USER)
      if (pathname === "/auth/bootstrap-status") {
        return devAuthJson({ hasUsers: true, authMode: "local", ...(modules ? { modules } : {}) })
      }
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    },
  }
})

// SSR is loaded lazily behind the non-API branch so the React + react-dom/server
// graph (~2.2 MB) is imported on first render rather than at boot. `src/server.ts`
// wires this `fetch` into the Node runtime via `createNodeServer`.
export const fetch = createWorkerFetch<AppBindings, ExecutionContext>({
  api: createApiDispatch<AppBindings, ExecutionContext>({
    loadApiApp: loadManagedApi,
    loadAuthApp: loadDevAuth,
  }),
  ssr: lazySsr(() => import("./ssr-handler").then((mod) => mod.handleSsrRequest)),
})

/** No scheduled work in this reference — accepted for `createNodeServer` parity. */
export async function scheduled(
  _event: ScheduledController,
  _env: AppBindings,
  _ctx: ExecutionContext,
): Promise<void> {}
