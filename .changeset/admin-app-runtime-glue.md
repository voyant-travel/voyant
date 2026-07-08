---
"@voyant-travel/admin-app": minor
---

Add `@voyant-travel/admin-app/runtime` — the profile-agnostic client runtime
glue for the managed-profile admin host (Phase 2 slice 1 of voyant#3044).

- `managedProfileAdminFetcher` — the isomorphic Voyant fetcher (`createIsomorphicFn`
  over `defaultFetcher`): on the client it normalizes package-emitted admin paths
  and sends session cookies; on the server it forwards the request cookie and
  rewrites absolute URLs onto the request origin. The `.server(...)` branch is
  stripped from client bundles by the TanStack Start build.
- `normalizeAdminApiUrl(url)` — rewrites package-emitted `/v1/<module>` paths onto
  the `/v1/admin/<module>` surface (generic admin-surface logic).
- `getManagedProfileAdminApiUrl()` — the same-origin `/api` base-URL helper.

This lifts the operator starter's `lib/voyant-fetcher.ts` / `lib/env.ts` /
`lib/operator-admin-api-paths.ts` into a package so the admin host is not
starter-owned; the starter files become thin re-export shims (their existing
export names are preserved, so consumers are unaffected). Naming is
profile-agnostic (no "operator" in the package identifiers).
