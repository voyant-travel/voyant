# ADR-0001: Tenant scoping is enforced at the deployment boundary, not in-process

- **Status:** Accepted (2026-04-25)
- **Closes:** [#287](https://github.com/voyant-travel/voyant/issues/287)

## Context

Voyant is a modular framework for travel-domain back-office software (DMC,
operator, supplier, distribution). Every domain module — bookings,
products, finance, transactions, etc. — runs against a single Postgres
database and is mounted into a single Hono app at deploy time.

Customers buy Voyant per organization. Voyant Cloud's commercial offering
provisions **one Postgres database + one Node application runtime per customer
organization**. Customers self-hosting Voyant own their own infra and run the
same one-DB-per-org topology.

There is no shared-tier today. There has never been one in the framework's
history. There are no schema columns named `organizationId` whose purpose
is to scope queries inside a domain module.

The question this ADR answers is whether to harden the framework with
defense-in-depth (mandatory in-process organization scoping at every
domain query) or to formalise the deployment-boundary contract as the
sole tenancy enforcement mechanism.

## Decision

**The deployment boundary IS the tenancy boundary.** Voyant does not ship
in-process organization-scoping middleware, an org-scoped Drizzle proxy,
or any query interceptor that auto-applies an `organizationId` filter.

Concretely, this means:

- No `requireOrgId` middleware in `@voyant-travel/hono`.
- No org-scoped wrapper around `createDbClient(...)`.
- No `organizationId` parameter is threaded through the request context
  for the purpose of filtering.
- Domain modules MAY include an `organizationId` column for reporting
  or grouping, but the framework does not enforce it at the query layer.

When asked "how is one customer's data isolated from another customer's?"
the answer is: **separate Postgres database, separate compute runtime.**
Voyant Cloud's provisioning is the enforcement; customers self-hosting
inherit the same model.

## Consequences

### Positive

- **No per-query overhead.** Every domain module's read path stays exactly
  one round-trip without an injected predicate.
- **No confused-deputy class of bugs.** There is no shared schema where a
  forgotten filter could leak across tenants — there's literally no
  cross-tenant data in the same database to leak to.
- **Deploy-time enforcement is hard to bypass accidentally.** A
  misconfigured Node application can't accidentally read another customer's DB
  unless someone hard-codes the wrong connection string.
- **Module authors don't carry tenancy concerns.** A bookings package author
  writes a list query and ships it; tenancy is somebody else's problem
  (specifically: Voyant Cloud's provisioning, or the self-hoster's infra).

### Negative

- **No defense in depth.** If Voyant Cloud's provisioning is ever
  misconfigured to point two customers at the same database, every
  domain module is a vector. There is no in-process safety net.
- **Self-hosters are on their own.** Customers running their own
  deployment must understand that tenancy is not enforced by the
  framework. A customer who tries to consolidate two organizations into
  one DB to save costs has zero protection.
- **Future shared-tier work would require a re-architecture.** If
  Voyant ever adds a "shared starter tier" (multiple orgs in one DB),
  every domain module would need to be audited for organization-scoping
  and a middleware/proxy layer would need to be added. This is a real
  cost; it was weighed and accepted.

### Mitigations

- **Provisioning audit.** Voyant Cloud's provisioning code MUST refuse
  to issue a connection string that points two organizations at the same
  database. This is a config-level invariant, not a code-level one.
- **Documentation.** This ADR + the customer-facing security posture
  doc are the disclosure mechanism for self-hosters.
- **Revisit gate.** If a shared-tier feature is ever proposed, this ADR
  must be revisited *before* that work starts, not after.

## Alternatives considered

### Alternative A: Defense-in-depth middleware

Add a mandatory `requireOrgId` middleware that pre-filters every domain
query on `organizationId`. Either via an org-scoped Drizzle proxy or a
query interceptor.

**Why rejected.** It imposes per-query cost on every domain module across
the framework for a threat that doesn't exist in any current deployment
topology. Adding it later (if a shared-tier ever ships) is feasible;
ripping it out if it bloats every read path is harder. The current
single-tenant deployment model is the actual product reality.

If the threat model ever shifts (shared-tier, multi-org dashboards on a
shared DB, etc.), this ADR is the place to mark superseded and the work
to add Alternative A becomes the new baseline.

### Alternative B: Hybrid (chosen)

Formalise the deployment-boundary contract as the security model. Document
that "single-tenant per deployment" is the explicit posture. Voyant
Cloud's provisioning enforces it. CI / lint checks prevent accidental
shared-DB configurations from landing in templates.

This is the path taken.

## How to apply this decision

When you are tempted to thread `organizationId` through a query for the
purpose of filtering by tenant, **stop and ask whether you're about to
violate this ADR.** If your code's correctness depends on a filter that
would only matter in a shared-tier deployment that doesn't exist, you're
adding cost for no benefit.

Fields named `organizationId` are fine as data — for example, "which
organization owns this booking" within a single-tenant deployment, where
the question is metadata, not isolation. The distinction is whether the
column exists for **partitioning data across customers** (forbidden by
this ADR — that's the deployment boundary's job) versus **labeling data
within one customer's installation** (fine — purely an organizational
concern of that customer's own model).
