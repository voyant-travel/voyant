---
"@voyant-travel/operator-standard": patch
---

Route admin auth-react requests to the admin realm. The operator's admin React
context was handed the shared admin fetcher unchanged, so `useSignUp` (and other
auth-react hooks) targeted the default `/auth/*` surface, which returns 404 now
that admin Better Auth is isolated under `/auth/admin/*`. This blocked
first-admin creation from the setup screen. The fetcher is now scoped to the
admin realm via `createAuthBasePathFetcher`, mirroring the storefront's
`/auth/customer` rewrite; non-auth URLs pass through unchanged.
