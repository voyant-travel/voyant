---
"@voyantjs/db": minor
"@voyantjs/notifications": minor
"@voyantjs/legal": minor
---

`resolveDb` callbacks in `createNotificationsHonoModule` and `createLegalHonoModule` now return `AnyDrizzleDb` (the `PostgresJsDatabase | NeonHttpDatabase` union from `@voyantjs/db`) instead of strictly `PostgresJsDatabase`. Templates wiring `getDbFromHyperdrive` no longer need the `as unknown as PostgresJsDatabase` apology cast.

New shared type alias `AnyDrizzleDb` exported from `@voyantjs/db`. Also normalized three `bindings: unknown` parameter types to `bindings: Record<string, unknown>` in `packages/legal/src/contracts/routes.ts` (`resolveDocumentGenerator`, `resolveDocumentDownloadUrl`, `resolveEventBus`) — was previously inconsistent with the rest of the workspace.
