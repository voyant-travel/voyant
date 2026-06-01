---
"@voyantjs/admin-contracts": minor
"@voyantjs/admin-client": minor
"@voyantjs/admin-react": minor
---

Expand the Admin API SDK (#1411).

- **admin-contracts (5.2):** add operation descriptors for CRM (people +
  organizations CRUD, plus the PII-gated person-document reveal), legal
  (contracts CRUD + issue/void, policies CRUD + cancellation evaluation), and
  products (read surface: list/get). Inputs derive from the canonical
  `@voyantjs/crm-contracts` / `@voyantjs/legal-contracts` route schemas; outputs
  are loose client-facing projections. Scopes follow the path+method convention
  `requireActor` enforces (GET→`:read`, POST/PATCH→`:write`, DELETE→`:delete`).
- **admin-client:** typed `crm`, `legal`, and `products` namespaces over the new
  descriptors.
- **admin-react (5.3):** new package — a generic React Query adapter over the
  admin client. `AdminClientProvider`/`useAdminClient`, plus descriptor-driven
  `useAdminQuery`, `useAdminMutation`, and `useCapabilities`. Works for any
  operation descriptor (current or future) rather than bespoke per-screen hooks.
