---
"@voyant-travel/admin": minor
---

Add the admin auth capability **port** for the managed-profile admin host
(`ManagedProfileAdminAuthRuntime`, `AdminBootstrapStatus`, `AdminAuthMode` from
`@voyant-travel/admin/app`) — Phase 2 of voyant#3044.

Auth is deployment-owned: the packaged admin shell/guard never import a concrete
auth client; a deployment supplies the port (a managed Voyant Cloud profile
provides a Cloud-broker impl, a self-host deployment a Better Auth impl).

`createAdminWorkspaceBeforeLoad` now takes the port (`{ auth }`) instead of a
bare `{ getCurrentUser }`, and resolves the unauthenticated destination from it:
`voyant-cloud` mode redirects to the Cloud identity-broker, otherwise to the
local `signInPath` — removing the previous double-hop through the local sign-in
page and keeping the packaged admin free of a concrete auth client.
