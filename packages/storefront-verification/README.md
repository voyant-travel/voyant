# @voyant-travel/storefront-verification

Public email and SMS verification challenges for storefront and checkout flows.

The package ships:

- a Hono public route module for `/v1/public/storefront-verification`
- a service for issuing, sending, and confirming verification challenges
- provider adapters that reuse `@voyant-travel/notifications` providers
- a Drizzle schema for persisted verification challenge state

## Install

```bash
pnpm add @voyant-travel/storefront-verification
```

## Usage

```ts
import { createStorefrontVerificationHonoModule } from "@voyant-travel/storefront-verification"

const storefrontVerification = createStorefrontVerificationHonoModule({
  resolveProviders: (bindings) => [
    // return NotificationProvider instances for email and/or sms
  ],
  email: {
    subject: "Your verification code",
  },
})
```

Mount the returned module in the same app that exposes the public route:

```ts
createApp({
  publicPaths: ["/v1/public/storefront-verification"],
  modules: [storefrontVerification],
})
```

## Database Schema

This module stores challenge rows in `storefront_verification_challenges`.
Apps that maintain an explicit Drizzle schema array must include the schema
entrypoint before generating migrations:

```ts
export default defineConfig({
  schema: [
    "../../packages/db/src/schema/index.ts",
    "../../packages/storefront-verification/src/schema.ts",
  ],
})
```

For package-based tooling, the published package declares:

```json
{
  "voyant": {
    "schema": "./schema",
    "requiresSchemas": ["@voyant-travel/db"]
  }
}
```

The first-party DMC and operator starters include this schema and ship a
migration for the challenge table. Downstream apps that mount the route module
should do the same; otherwise the first verification request will fail when the
service tries to read or write `storefront_verification_challenges`.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Hono module factory, service exports, validation exports, schema exports |
| `./schema` | Drizzle tables, enums, linkable metadata, module definition |
| `./public-routes` | Public route factory |
| `./service` | Verification service and provider adapter helpers |
| `./validation` | Zod request/response schemas |

## License

Apache-2.0
