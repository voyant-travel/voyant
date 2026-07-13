# @voyant-travel/admin-host

Versioned host for Voyant's standard operator frontend and its Node serving
seams. It owns the standard providers, presentation adapters, generated route
runtime, TanStack Start policy, styles, static-asset host, and SSR handler.

## Install

```bash
pnpm add @voyant-travel/admin-host
```

## Exports

| Entry | Description |
| --- | --- |
| `./presentation` | `createAdminHostPresentation(...)` - composes the selected graph, core admin, and explicit project-local admin convention |
| `./standard-frontend` | `createStandardOperatorFrontend(...)` - composes standard auth, providers, public/storefront routes, workspace, and router behavior |
| `./standard-route-files` | Generated file-router hosts backed by the standard frontend runtime |
| `./standard-styles.css` | Tailwind sources and standard package styles |
| `./start` | Standard TanStack Start SSR and CSRF policy |
| `./serve` | `serveAdminHost(...)` - Hono Node host that serves built client assets, then falls through to the combined API + SSR app |
| `./ssr` | `createAdminSsrHandler(...)` - the TanStack Start SSR handler (`createStartHandler` + active-route manifest restriction) |
| `.` | Barrel re-exporting both |

## Usage

```ts
// server.ts — Node static host + fall-through to the composed app
import { serveAdminHost } from "@voyant-travel/admin-host/serve"
import { fetch as appFetch } from "./entry"

const web = serveAdminHost({ clientAssetsDir: CLIENT_DIR, app: appFetch })
```

```ts
// ssr-handler.ts — packaged SSR handler, dynamic-imported behind the non-API branch
import { createAdminSsrHandler } from "@voyant-travel/admin-host/ssr"

export const handleSsrRequest = createAdminSsrHandler()
```

The SSR handler relies on the consuming app's TanStack Start build to provide
the router.

## Consumers

Consumed by Node deployments, including the standard project in
`starters/operator`.

## License

Apache-2.0
