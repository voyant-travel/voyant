---
"@voyant-travel/hono": minor
"@voyant-travel/types": minor
"@voyant-travel/utils": minor
"@voyant-travel/db": minor
---

Remove deprecated beta compatibility surfaces in favor of their canonical APIs.

- Import Hono transport bundles from `@voyant-travel/hono/bundle` and use
  `HonoBundle`, `defineHonoBundle`, and `expandHonoBundles`.
- Import public document delivery APIs from
  `@voyant-travel/public-document-delivery`.
- Use permission-named API key helpers instead of the removed scope aliases.
- Use `createRedisKvStore` for Redis-backed caching instead of the removed
  no-op Redis compatibility functions.
- Use `entityTagColumns` instead of `tagsCoreColumns`.
