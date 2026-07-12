# @voyant-travel/admin-host

Profile-agnostic admin **serving seam** for Voyant: the Node static-asset host
and the TanStack Start SSR handler that admin hosts wrap around their composed
app. The profile is a snapshot field, never baked into an identifier here.

## Install

```bash
pnpm add @voyant-travel/admin-host
```

## Exports

| Entry | Description |
| --- | --- |
| `./serve` | `serveAdminHost(...)` - Hono Node host that serves built client assets, then falls through to the combined API + SSR app |
| `./ssr` | `createAdminSsrHandler(...)` - the TanStack Start SSR handler (`createStartHandler` + active-route manifest restriction) |
| `./managed-profile-compatibility` | Deprecated aliases for snapshot-era external callers |
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

Consumed by the operator starter (`starters/operator`) and the future managed
admin host (voyant#3044).

## License

Apache-2.0
