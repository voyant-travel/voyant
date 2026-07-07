---
"@voyant-travel/framework": patch
"@voyant-travel/hono": patch
---

Wire the managed profile runtime to the Voyant Cloud admin auth flow. Managed
Cloud apps now install the Cloud Better Auth plugin, resolve Better Auth cookie
sessions with Cloud revalidation, revalidate Cloud-backed API-key users, and
redirect unauthenticated admin UI requests into the Cloud sign-in flow while
leaving API callers on JSON 401 responses.

Add an optional `onUnauthorized` hook to the Hono auth integration contract so
deployments can customize the final unauthenticated response after all shared
credential strategies fail.
