import { fileURLToPath } from "node:url"

import {
  type AppLoader,
  createApiDispatch,
  createWorkerFetch,
  lazyApp,
  lazySsr,
} from "@voyant-travel/runtime"

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

/**
 * Resolve the managed-profile snapshot the runtime composes from.
 *
 * `MANAGED_PROFILE_SNAPSHOT` wins when set (the robust deployment path — the
 * orchestrator passes an absolute path at boot). Otherwise we resolve
 * `managed-profile.json` relative to this module. At runtime this module is
 * `dist/server/server.js`, so `../managed-profile.json` points at `dist/` — the
 * `build` script copies `managed-profile.json` into `dist/` (see
 * `copy:snapshot`) precisely so this relative resolution lands on a real file.
 */
function resolveSnapshotPath(): string {
  const fromEnv = process.env.MANAGED_PROFILE_SNAPSHOT?.trim()
  if (fromEnv) return fromEnv
  return fileURLToPath(new URL("../managed-profile.json", import.meta.url))
}

const loadManagedApi: AppLoader<AppBindings, ExecutionContext> = lazyApp(async () => {
  const { loadManagedProfileRuntime } = await import("@voyant-travel/framework/managed-runtime")
  const runtime = await loadManagedProfileRuntime({ profileSnapshotPath: resolveSnapshotPath() })
  // The runtime serves the API from its own composed env (process.env), so we
  // drop the dispatch-supplied env/ctx and defer entirely to `runtime.fetch`.
  return { fetch: (request) => runtime.fetch(request) }
})

// SSR is loaded lazily behind the non-API branch so the React + react-dom/server
// graph (~2.2 MB) is imported on first render rather than at boot. `src/server.ts`
// wires this `fetch` into the Node runtime via `createNodeServer`.
export const fetch = createWorkerFetch<AppBindings, ExecutionContext>({
  api: createApiDispatch<AppBindings, ExecutionContext>({ loadApiApp: loadManagedApi }),
  ssr: lazySsr(() => import("./ssr-handler").then((mod) => mod.handleSsrRequest)),
})

/** No scheduled work in this reference — accepted for `createNodeServer` parity. */
export async function scheduled(
  _event: ScheduledController,
  _env: AppBindings,
  _ctx: ExecutionContext,
): Promise<void> {}
