# @voyant-travel/worker-runtime

Framework-owned Cloudflare Worker entry logic for Voyant apps: API/auth/SSR
dispatch and SSR-manifest restriction, delivered as a versioned package
instead of copied template files.

Part of the Packaged Admin direction (`docs/architecture/packaged-admin-rfc.md`,
Phase 0): a project's `entry.ts` shrinks to bindings + factory calls, and
fixes to this load-bearing code path arrive via a dependency bump.

## What it does

- **`createApiDispatch({ loadApiApp, loadAuthApp? })`** — routes hosting-URL
  requests (`/api/*`) onto the app surface (`/v1/*`, `/auth/*`, `/health`),
  stripping the prefix and preserving method/headers/body/search. When
  `loadAuthApp` is set, `/api/auth/*` dispatches to the lean auth app without
  instantiating the full API graph (the cold-start outage fix). Hosts can opt
  into `warmApiOnAuth: true` to warm the full app in the background on
  non-OPTIONS auth traffic, but the default keeps auth requests isolated.
  Hosts can pass `rewriteAppPath` for compatibility redirects that must happen
  after prefix stripping and before the request reaches the app.
- **`createWorkerFetch({ api, ssr })`** — the Worker `fetch` entrypoint:
  API-prefixed requests go to the dispatch, everything else to the SSR handler.
- **`withActiveRouteSsrManifest(streamHandler)`** — restricts the TanStack
  Start SSR manifest to the active route matches so the first paint isn't
  flooded with speculative preloads. Structurally typed; no router dependency.
- **`lazyApp(load)`** — memoizes an app loader per isolate.

## Usage

```ts
// src/entry.ts
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { createWorkerFetch, lazyApp, withActiveRouteSsrManifest } from "@voyant-travel/worker-runtime"

const startHandler = createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))

const fetch = createWorkerFetch<CloudflareBindings>({
  api: {
    loadApiApp: lazyApp(() => import("./api/app").then((m) => ({ fetch: m.app.fetch }))),
    loadAuthApp: lazyApp(() => import("./api/auth-app").then((m) => ({ fetch: m.authApp.fetch }))),
  },
  ssr: (request, env) => startHandler(request, { context: { env } } as never),
})

export default { fetch }
```

Scheduled (cron) handlers and workflow wiring remain app-owned composition —
see RFC §4.4.

## License

Apache-2.0
