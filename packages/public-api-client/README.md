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

The SDK does not own HTTP routes or business state. React consumers should
layer their hooks on this package instead of reimplementing request paths.
