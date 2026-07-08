---
"@voyant-travel/admin-react": minor
---

Add `@voyant-travel/admin-react/user` — a reusable current-user context
(`UserProvider` / `useUser`) for the managed-profile admin host (Phase 2 of
voyant#3044).

The provider reads the current user via React Query and takes `getCurrentUser`
injected (typically the deployment's auth-runtime port), so it carries no
auth-client dependency and is shared by managed and self-host admin hosts. It
lifts the operator starter's local `UserProvider`/`useUser` into a package; the
starter's provider becomes a thin adopter that wires its auth runtime.
