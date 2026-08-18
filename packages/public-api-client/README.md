# `@voyant-travel/public-api-client`

Framework-agnostic TypeScript client for custom Voyant public surfaces.

The client is generated from Voyant's composed Public API OpenAPI document. The
credential selects the TypeScript surface: a publishable (`vpk_`) key can call
only browser-safe operations, while a secret (`vsk_`) key can call the complete
public surface from a server. A secret-only path is absent from the publishable
client type.

```ts
import { createPublicApiClient } from "@voyant-travel/public-api-client"

const voyant = createPublicApiClient({
  baseUrl: "https://api.voyant.travel",
  publishableKey: process.env.PUBLIC_VOYANT_KEY!,
})

const { data, error } = await voyant.GET("/v1/public/settings")
if (error) throw new Error("Could not load public settings")
```

Use a secret key only in server-side code:

```ts
const serverVoyant = createPublicApiClient({
  baseUrl: "https://api.voyant.travel",
  secretKey: process.env.VOYANT_SECRET_KEY!,
})
```

`baseUrl`, a custom Fetch implementation, and the other `openapi-fetch`
options are supported. The client always pins the validated credential header;
constructor or per-call headers cannot replace it.

## Voyant-managed Sites

Voyant-managed Sites use the same generated client through the canonical
same-origin `/v1/public/*` proxy. The managed Fetch seam rewrites only the
request origin; it does not define another operation layer or change the
client's credential posture.

```ts
import {
  createManagedPublicApiFetch,
  createPublicApiClient,
} from "@voyant-travel/public-api-client"

const origin = new URL(Astro.request.url).origin
const voyant = createPublicApiClient({
  // openapi-fetch constructs an absolute URL before calling custom Fetch.
  baseUrl: "https://api.voyant.travel",
  publishableKey: import.meta.env.VOYANT_PUBLIC_API_KEY,
  fetch: createManagedPublicApiFetch({ proxyOrigin: origin }),
})
```

The host is responsible for implementing and authorizing the proxy. The Fetch
seam accepts only canonical `/v1/public` requests and preserves their path,
query, method, headers, body, streaming response, and abort behavior. During
browser rendering, `window.location.origin` can be used as `proxyOrigin`.

Externally hosted Themes should continue to use a Voyant API `baseUrl` and a
`vpk_` publishable key or server-only `vsk_` secret key directly, without this
managed transport.

The SDK does not own HTTP routes or business state. React consumers should
layer their hooks on this package instead of reimplementing request paths.
