# @voyant-travel/openapi

The generated **OpenAPI 3.1** specification for the Voyant framework's standard
API surface. This package ships JSON only — it has no runtime dependencies.

## What's in it

The spec is generated from the framework's standard module composition, so it is
the union of every standard module's `createRoute(...).openapi(...)` contract at
its real mounted path. Deployment-specific routes (a starter's payment-provider
webhooks, niche modules like MICE or cruises) are **not** included — this is the
portable framework contract, not any one deployment's surface.

| Export | File | Surface |
| --- | --- | --- |
| `@voyant-travel/openapi` | `spec/framework-openapi.json` | everything (admin + storefront + legacy) |
| `@voyant-travel/openapi/admin` | `spec/framework-admin.json` | `/v1/admin/*` |
| `@voyant-travel/openapi/storefront` | `spec/framework-storefront.json` | `/v1/public/*` |

```ts
import frameworkSpec from "@voyant-travel/openapi"
import adminSpec from "@voyant-travel/openapi/admin"
```

A docs site (or any consumer) depends on this package like any other and reads
the JSON — a decoupled producer→consumer relationship with no cross-repo wiring.

## Regenerating

The committed `spec/*.json` files are the source of truth and are guarded by a
drift gate: `pnpm --filter @voyant-travel/openapi test` regenerates the docs
in-memory and fails if they differ from what's committed. After an intentional
framework route change:

```sh
pnpm --filter @voyant-travel/openapi generate
```

This composes the framework-only app (with stub providers — no request is ever
served) and rewrites the artifacts. See voyant#2114.
