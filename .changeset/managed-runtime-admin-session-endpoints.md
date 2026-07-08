---
"@voyant-travel/framework": minor
---

Expose the admin-session auth endpoints on the managed profile runtime so a
source-free managed admin host can resolve its current user and bootstrap
status from the managed API in one process (voyant#3044, on the #2987 runtime).

`createManagedCloudAuthApp` now serves `GET /auth/me` (the current staff user,
or 401) and `GET /auth/bootstrap-status` (`{ hasUsers, authMode }`) — the
endpoints the packaged admin's `ManagedProfileAdminAuthRuntime` port fetches.
They mirror the operator starter's `getCurrentUserForRequest` /
`getBootstrapStatusForRequest` using packaged primitives
(`createManagedBetterAuth` + `@voyant-travel/db/schema/iam`). Also exports
`createManagedCloudAuthApp`, `ManagedCurrentUser`, and `ManagedBootstrapStatus`.
