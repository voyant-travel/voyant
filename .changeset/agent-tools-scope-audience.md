---
"@voyant-travel/types": minor
"@voyant-travel/core": minor
"@voyant-travel/hono": minor
"@voyant-travel/auth": minor
---

Extend the api-key permission grammar for fine-grained agent operations and carry
an audience on the key grant.

- `@voyant-travel/types`: add `cancel`/`refund`/`void`/`publish`/`send` actions and
  `dashboard`/`content`/`media`/`bookings-pii` resources (with descriptor groups);
  PII resources are never satisfied by the `*` wildcard; add `assertKnownPermissions`
  and `API_KEY_GRANT_PRESETS` (a scope subset bundled with an audience).
- `@voyant-travel/core`: add `audience` to `VoyantAuthContext`.
- `@voyant-travel/hono`: derive an API key's audience from its grant metadata and let
  the request actor follow it (replacing the hardcoded staff default).
- `@voyant-travel/auth`: validate permission strings and audience at key-mint time and
  resolve grant presets.
