---
"@voyantjs/auth": minor
---

`createBetterAuth` enables Better Auth's session `cookieCache` by default (signed cookie, 5-minute TTL): `getSession` answers from the cookie with zero Postgres roundtrips on most requests. Trade-off: a revoked session can stay usable for up to `maxAge` seconds. Disable with `sessionCookieCache: false` or tune via `sessionCookieCache: { maxAge }` for revocation-sensitive deployments.
