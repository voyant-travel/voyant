# ADR-0014: Separate admin and customer authentication realms

- **Status:** Accepted (2026-07-18)
- **Relates to:**
  [Auth and identity architecture](../architecture/auth-identity-architecture.md),
  [Module/provider/plugin taxonomy](../architecture/module-provider-plugin-taxonomy.md), and
  [Deployment targets](../architecture/deployment-targets.md)

## Context

The Operator and storefront previously mounted one Better Auth instance. The
customer path was rewritten to the admin path, so both surfaces shared users,
accounts, sessions, cookies, secrets, and email uniqueness. In managed mode the
admin WorkOS broker allow-list also disabled customer sign-up routes.

Staff authorization and storefront customer accounts are different security
realms. Equal email addresses must not implicitly link them or transfer
privileges.

## Decision

1. Better Auth remains Voyant's default local session engine.
2. Managed staff identity is verified by the Voyant Cloud/WorkOS adapter and
   exchanged for a local Better Auth admin session.
3. Admin and customer auth use separate Better Auth instances, Postgres tables,
   cookie prefixes, signing secrets, and base paths: `/auth/admin/*` and
   `/auth/customer/*`.
4. Customer identities link explicitly to CRM people by stable ids. Email is
   discovery data, never a cross-realm linkage key.
5. Deployment graphs select `adminAuth` and `customerAuth` independently. The
   old `auth` value remains an emitted/read alias for `adminAuth` for one
   compatibility cycle.
6. External IdPs should implement `ExternalIdentityAdapter` and converge on a
   standard Better Auth session. A full session replacement may implement
   `AuthRealmSessionPort`.
7. Merchant OAuth credentials are resolved at runtime. Only enabled-method
   metadata and opaque vault references may be stored in deployment config.

## Consequences

- A customer cookie cannot authenticate an admin route, and an admin cookie
  cannot authenticate a storefront route.
- Managed deployments can keep local customer sign-up enabled while local admin
  credential routes remain disabled.
- Existing shared customer identities require an explicit migration; the
  framework does not copy or auto-link users by email.
- Self-hosters may use Better Auth's email/social providers or supply an
  external identity adapter without coupling domain modules to Better Auth.

## Alternatives considered

### Use WorkOS for both realms

Rejected as the default. Storefront provider credentials and branding are
merchant-scoped, and self-hosted deployments need a provider-neutral local path.

### Share Better Auth storage but stamp a realm field

Rejected. Shared cookies, unique constraints, and accounts leave privilege
confusion and accidental email linking possible.
