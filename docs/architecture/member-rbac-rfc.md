# Member RBAC & Granular Permissions (RFC)

Status: **Draft** · Tracking: [voyant#2085](https://github.com/voyant-travel/voyant/issues/2085) · Owners: platform + admin · Related: deployment member management (branch `feat/deployment-member-management`), [auth-identity-architecture.md](./auth-identity-architecture.md), [booking-pii.md](./booking-pii.md)

This RFC specifies role-based access control for **people** (staff members) inside a Voyant admin deployment — granular, per-module, Shopify-style — covering both `local` and `voyant-cloud` auth modes, the platform side that brokers cloud auth, and the assignment UI.

---

## 1. Problem statement

A Voyant admin deployment today has **no in-app RBAC for human sessions**. Every authenticated session is granted full access:

```ts
// starters/operator/src/api/auth/handler.ts — resolveAuthRequest()
return {
  userId: session.user.id,
  // ...
  actor: "staff",
  scopes: ["*"], // every session is a superuser, local AND cloud
}
```

Consequences:

- An admin cannot give a teammate limited access (e.g. "manage catalog but not finance", "read-only"). Everyone who can sign in can do everything.
- In `voyant-cloud` mode the login assertion already carries `roleSlug` / `roleName` / `surfaces`, persisted to `cloud_auth_user_links` — but `resolveAuthRequest` **ignores** them and still returns `["*"]`.
- The member-management work (the platform-brokered roster + the `TeamSettingsPage` assignment UI on branch `feat/deployment-member-management`) lets an admin assign a WorkOS org role and grant deployment access, but the deployment **does not enforce** any distinction between those roles once a member is in.

This is also flagged in the security audit (no RBAC/MFA/audit-log). This RFC closes the RBAC gap.

### Goals

- Granular, **per-module / per-action** permissions for staff members (Shopify-style), not just coarse roles.
- **Preset roles** (Admin / Editor / Viewer) as named permission bundles, with per-member customization on top.
- **One permission vocabulary** shared by API keys and people — no second catalog.
- Works in **both** auth modes (`local`, `voyant-cloud`) through a single enforcement seam.
- A **single assignment surface** (the Team page) in both modes.
- **Default-deny** once enforced: a member only has what they were granted.

### Non-goals

- SaaS **billing** permissions — billing is a Voyant Cloud platform concern, not exposed in the deployment admin. Out of scope here.
- MFA, audit logging, session policies (tracked separately in the security-hardening effort).
- Customer/partner/supplier actor permissions — this RFC is about `staff` sub-roles. The existing actor guards (`requireActor`) are unchanged.
- Per-record / row-level / field-level access (only `bookings-pii` reveal exists today and is retained as-is).

---

## 2. Background — what already exists (verified)

The authorization machinery is present; only the human-session path is unused.

**Auth context** (`packages/core/src/env.ts`) carries `scopes?: string[]` and `actor`. `VoyantRequestAuthContext` (`packages/hono/src/types.ts`) is what `resolveAuthRequest` returns and `applyAuthContext` sets on the request.

**Enforcement primitives** (all in `packages/hono`):
- `requireActor(...actors)` — gates surfaces by actor; `/v1/admin/*` → `staff` (`app.ts`).
- `requirePermission(resource, action)` — gates a route on a `resource:action` scope, reading `c.get("scopes")`; falls back to `auth.hasPermission()`. **Already implemented, barely wired** (sessions are `*`, so nothing gates).
- PII reveal: `shouldRevealBookingPii({ actor, scopes })` checks `scopes.includes("bookings-pii:read")` (`packages/bookings/src/pii-redaction.ts`). The one place session scopes already matter.

**A complete permission catalog already exists** for API keys — `API_KEY_PERMISSION_GROUPS` in `packages/types/src/api-keys.ts`:
- Actions: `read · write · delete · trigger · relay · search`.
- Resources (20): `availability, bookings, catalog, crm, cruises, departures, finance, ground, accommodations, itineraries, legal, notifications, pricing, products, resources, storefront, suppliers, transactions, webhooks, workflows`.
- Each permission has a `{ resource, action, label, description }` descriptor, grouped for a checklist UI.
- Helpers: `permissionsToStrings`, `hasApiKeyPermission(s)`, wildcard semantics (`*`, `*:*`, `resource:*`).

**A `roles` pgEnum** exists but is unwired: `super-admin, admin, editor, viewer, member, guest` (`packages/db/src/schema/iam/roles.ts`).

**Cloud assertion** (`packages/auth/src/cloud-broker/assertion.ts`) carries `roleSlug`, `roleName`, `surfaces`; persisted to `cloud_auth_user_links` (`roleSlug`, `roleName`, `surfaces` columns) by the cloud-admin-session mirror.

**`user_profiles`** has only `isSuperAdmin` / `isSupportUser` booleans — no per-user role/permission column yet.

**Key insight:** member RBAC needs *no new permission vocabulary*. It reuses `API_KEY_PERMISSION_GROUPS` so a member's grant is the same shape as an API key's, and the same `requirePermission` gate enforces both.

---

## 3. Design

### 3.1 Permission model

A member's access is a set of `resource:action` permission strings — identical to API keys — drawn from `API_KEY_PERMISSION_GROUPS`. Wildcards (`*`, `resource:*`) carry their existing meaning. This becomes the canonical "permission set" type, shared by API keys and members.

### 3.2 Roles as preset bundles (+ custom)

Preset roles are **named bundles** of permissions, defined once in a shared module so the platform (assignment UI) and the deployment (enforcement) agree:

| Role | Bundle |
|------|--------|
| **Admin** | `*` (everything, including team + settings) |
| **Editor** | `read`+`write` on operational resources (catalog, products, bookings, crm, availability, pricing, suppliers, itineraries, departures, accommodations, ground, legal, notifications); **no** `delete`, **no** finance-write, **no** team/settings |
| **Viewer** | every resource `:read` (and `:search` where applicable) |
| **Custom** | any explicit subset an admin ticks |

**Presets are non-binding convenience defaults, not policy.** The real model is granular: every module exposes **View** (`read`/`search`) and **Edit** (`write`) toggles, plus separately-gated **sensitive sub-actions** where they exist (`delete`, finance issue/void, `bookings-pii:read`) — the Shopify pattern of separating "Edit orders" from "Refund orders". A preset just pre-ticks a sensible set; the admin then toggles any module's view/edit per member. So there is no hard "Editor can/can't do Finance" rule — Finance is just another module with its own view/edit toggles, and the Editor preset merely *defaults* finance to view-only, which the admin can change.

### 3.3 Storage & flow

```
                        ┌─────────────── voyant-cloud mode ───────────────┐
 Admin assigns          │  platform: organization_memberships             │
 in Team page  ───────► │    .deploymentPermissions[appId] = string[]     │
 (TeamSettingsPage)     │  (opaque to platform, like deploymentAccess)    │
                        │            │ login → assertion.scopes           │
                        │            ▼                                     │
                        │  deployment: cloud_auth_user_links.scopes       │
                        └────────────────────┬────────────────────────────┘
                                             │
 Admin assigns          ┌─────────────── local mode ──────────────────────┐
 in Team page  ───────► │  deployment: user_profiles.permissions string[] │
                        └────────────────────┬────────────────────────────┘
                                             ▼
                          resolveAuthRequest() emits member scopes
                                             ▼
                          requirePermission(resource, action) gates routes
```

- **Cloud mode.** The per-member, per-deployment permission set lives on the **platform** `organization_memberships` row, scoped by the deployment's `appId` (a sibling to the existing `deploymentAccess`/`platformAccess` jsonb). The platform treats these strings as **opaque** — exactly as it already treats `deploymentAccess` app-ids and `surfaces`. They are minted into the login **assertion** (`scopes: string[]`), and the deployment persists them to a new `cloud_auth_user_links.scopes` column on each assertion. Revalidation refreshes them.
- **Local mode.** Stored on a new `user_profiles.permissions` jsonb column in the deployment DB.
- **Source of truth at request time** is the deployment's own copy (`cloud_auth_user_links.scopes` / `user_profiles.permissions`), so enforcement never makes a network call.

> **Layering note.** The permission *catalog* is deployment-defined; the platform only stores/relays opaque strings. This keeps one assignment surface (the Team page) and reuses everything already built, at the cost of the platform holding deployment-defined strings. This is consistent with how the platform already stores `deploymentAccess` and `surfaces`. The decision is recorded in §7 as the chosen approach.

### 3.4 Assignment surface

The `TeamSettingsPage` (packages/admin) — already cloud-aware on `feat/deployment-member-management` — gains a **permission editor**: the grouped checklist rendered from `API_KEY_PERMISSION_GROUPS` (the same UX API keys use) plus a preset-role picker. Owner/admin members show as "Full access" and are not editable here (managed centrally), consistent with the existing member UI.

### 3.5 Enforcement

1. `resolveAuthRequest` stops hardcoding `["*"]`. It resolves the member's scope set:
   - cloud: read `cloud_auth_user_links.scopes` for the session user (fallback to role-bundle from `roleSlug` if `scopes` absent — back-compat);
   - local: read `user_profiles.permissions` (fallback `["*"]` for `isSuperAdmin`, else the default role).
2. Admin routes gate mutations via `requirePermission(resource, action)` — the machinery exists; the work is wiring it across module admin routes.
3. Wildcard `*` (owner/admin) bypasses every gate, preserving today's behavior for admins.

---

## 4. Data-model & API changes

**Deployment (`voyant` repo):**
- `packages/db` — `user_profiles.permissions jsonb<string[]>` (local mode); `cloud_auth_user_links.scopes jsonb<string[]>` (cloud cache). Migration + drizzle config.
- New shared module (e.g. `@voyant-travel/types/permissions` or `packages/auth`) — role→bundle definitions + `resolveScopesForRole`, reusing `API_KEY_PERMISSION_GROUPS`.
- `starters/operator/src/api/auth/handler.ts` — `resolveAuthRequest` reads the member scope set (both modes).
- `requirePermission` wired across `/v1/admin/*` module routes (phased).
- `TeamSettingsPage` permission editor; `/v1/admin/team/*` routes accept/return a member permission set (cloud → platform; local → user_profiles).

**Platform (`voyant-cloud` repo):**
- `organization_memberships` — per-app permission map (sibling to `deploymentAccess`). Migration.
- `admin-auth-broker` — include resolved `scopes` in the assertion payload; member endpoints (built on `feat/deployment-member-management`) accept/return the permission set.
- The deployment-member endpoints' invite/update paths persist the chosen permissions.

**Assertion contract:** add `scopes?: string[]` to `CloudAdminAssertion` (back-compat: absent ⇒ derive from `roleSlug`).

---

## 5. Security considerations

- **Default-deny once enforced.** After Phase 3, an unmatched gate denies. Until then, behavior is unchanged (members still effectively `*`) to avoid a half-enforced state locking people out — see phasing.
- **Privilege-escalation guard.** Only org managers (owner/admin) may assign permissions — already enforced server-side by the manage-role gate on the deployment member endpoints (`feat/deployment-member-management`). A member can never grant themselves more than they have; the deployment never trusts a self-reported role/scope (re-verified on the platform).
- **Team & settings are admin-only.** Granting `bookings:write` must not expose member management or auth/settings. `team:*` and a `settings:*` (new resource) gate those surfaces; only Admin/`*` holds them.
- **Wildcard semantics unchanged.** `*` / `resource:*` keep their meaning; owner/admin map to `*`.
- **PII reveal unchanged.** `bookings-pii:read` remains a distinct, separately-granted scope (`booking-pii.md`).
- **Opaque platform storage.** The platform stores deployment-defined scope strings without interpreting them; it cannot mint scopes the deployment catalog doesn't define (the deployment validates on assignment).

---

## 6. Rollout plan

**Phase 1 — Foundation (no behavior change).**
Shared role→bundle module; storage columns (`user_profiles.permissions`, `cloud_auth_user_links.scopes`) + migrations; assertion `scopes`; `resolveAuthRequest` emits real scopes (admins → `*`, so nothing breaks). Ships dormant — routes don't gate yet.

**Phase 2 — Assignment.**
Platform membership permission storage + assertion minting; deployment member endpoints carry permission sets; `TeamSettingsPage` permission editor (preset + checklist) for cloud and local. Admins can now *assign*; still not enforced.

**Phase 3 — Enforcement (opt-in, reversible). _Implemented._**
Rather than gate each route by hand, enforcement lives in `requireActor` (`packages/hono`), which already maps path→resource + method→action to gate API-key callers. The staff-session branch now enforces the member's scope set the same way. This covers **every** admin route that maps to a catalog resource at once — a Viewer can't write *anywhere*, not just on hand-gated routes — which is safer than gradual coverage. Paths with no mapped resource (e.g. `_meta`) stay open. `settings`/`team` resources were added to the catalog so those admin-only surfaces are gateable.

Enforcement is **opt-in per deployment** via `VOYANT_RBAC_ENFORCE` (default off): existing deployments — where non-admin members may rely on historical full access — are unaffected until they flip it on after reviewing roles/permissions. Full-access members (`*`) bypass regardless. API-key enforcement is unchanged (always on).

**Acceptance:** with the flag on — a Viewer cannot mutate anything; an Editor cannot touch team/settings/finance-write/deletes; an Admin (`*`) is unchanged; API-key behavior is untouched; both auth modes resolve identical scopes for the same role.

**PII reveal — _implemented._** `shouldRevealBookingPii` (`pii-redaction.ts`) now takes an `enforceRbac` flag (sourced from `isStaffRbacEnforced(c.env)` at every call site in bookings + legal). With the flag off, staff reveal PII as before; with it on, staff are gated by `bookings-pii:read`/`bookings-pii:*`/`*` like everyone else (full-access members keep access). Internal requests always bypass.

_Remaining (future hardening):_ map finer sub-resources (e.g. `products/:id/media` vs `products`) if per-sub-resource gating is wanted; PII columns are still plaintext-at-rest (separate encryption follow-up, pre-existing).

---

## 7. Open questions / decisions

1. **Cloud permission storage** — ✅ Resolved: **platform-stored, assertion-carried, opaque** (§3.3). Alternative (deployment-owned, keyed by WorkOS user id) rejected because it splits assignment across two surfaces.
2. **`settings`/`team` resources** — ✅ Resolved: added to `API_KEY_RESOURCES` + the permission catalog (read/write), so admin-only surfaces are gateable and assignable in the editor.
3. **Default-deny cutover** — ✅ Resolved: enforcement is centralized in `requireActor` and **opt-in** via `VOYANT_RBAC_ENFORCE` (default off), rather than a per-module hand-gate. Unmapped paths stay open; full-access (`*`) bypasses.
4. **Shared role/bundle module location** — ✅ Resolved: `@voyant-travel/types` (`./member-roles`), alongside the catalog.

> Resolved: preset bundles (incl. "Editor × Finance") are non-binding defaults, not policy — every module has independent view/edit toggles the admin overrides per member (§3.2). No product call needed.

---

## 8. Appendix — preset bundles (initial)

```
Admin   → ["*"]
Viewer  → every resource ":read"  (+ ":search" where the resource supports it)
Editor  → ["read","write"] on:
            catalog, products, bookings, crm, availability, pricing,
            suppliers, itineraries, departures, accommodations, ground,
            legal, notifications, resources
          + finance:read           (default only — admin can toggle to finance:write or off)
          NO delete, NO finance:write, NO team/settings, NO webhooks/workflows manage
```

(Exact bundles are code in the shared module; this table is only a default starting point — every module's view/edit is independently overridable per member.)
