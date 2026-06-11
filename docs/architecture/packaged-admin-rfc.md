# Packaged Admin RFC (the admin ships as a versioned app, projects become hosts)

Status: RFC / proposal — tracked in voyant#1643; motivated by voyant#1641
(incident & delivery-model analysis)
Audience: anyone who has shipped a fix to `templates/operator` and realized
existing deployments will never receive it; anyone scaffolding a new client
project and wondering which of the ~40k copied lines they actually own.

Related: [`admin-architecture.md`](./admin-architecture.md) (this RFC revises
Rule 2 — see §7), [`frontend-package-strategy.md`](../frontend-package-strategy.md),
[`migration-resilience-rfc.md`](./migration-resilience-rfc.md) (the same
"one manifest drives everything" principle, applied to the admin surface),
[`adr/0003-admin-api-contract-sdk.md`](../adr/0003-admin-api-contract-sdk.md).

---

## 0. TL;DR

Voyant has **two delivery models** for the same product:

- **Backend:** config-driven. `createApp({ modules, extensions, plugins })`
  plus the `voyant.config.ts` manifest. A fix in `@voyantjs/hono` or any module
  reaches every deployment as a version bump.
- **Admin frontend + worker infrastructure:** fork-and-own. Every project
  starts as a copy of `templates/operator` and immediately diverges. A fix in
  the template reaches **zero** existing deployments.

voyant#1641 documents what that costs: the #1636 outage ("admin never loads")
was fixed by #1638, whose package half shipped automatically and whose template
half (`entry.ts` / `hono-api-dispatch.ts`) had to be hand-ported into every
diverged project. Same fix, two delivery models, and the load-bearing half was
the manual one. The same pattern recurs with every template-level improvement
(#1631/#1637 cold-start chunking, #1642 SSR preloads).

The fork surface today, measured on `templates/operator`:

| Surface | Size | Delivery today |
| --- | --- | --- |
| Route files (`src/routes/**`) | 103 files, ~8,100 LOC | copied, diverges |
| Components (`src/components/**`) | 158 files, ~33,200 LOC | copied, diverges |
| Worker entry + dispatch (`entry.ts`, `hono-api-dispatch.ts`) | ~380 LOC | copied, diverges |
| Build config (`vite.config.ts` incl. chunking, SSR preloads) | copied, diverges |
| Backend wiring (`createApp` + manifest) | config | ✅ version bump |

**Proposal: invert ownership of the admin.** The admin becomes a versioned
application delivered by `@voyantjs/admin` (`createAdminApp(...)`). Domain
packages contribute their pages, navigation, and widgets through the
`AdminExtension` seam that already exists and that `templates/operator`
already uses for promotions, trips, and the action ledger. The worker dispatch
and build preset become packages. A project shrinks to:

1. `voyant.config.ts` — the manifest (modules, extensions, plugins, admin config)
2. thin entry files that call package factories
3. `src/admin/` — genuinely custom pages, widgets, and overrides

This is the model mature platform products converged on: the dashboard arrives
as a dependency, customization happens through sanctioned extension points,
and upgrading the admin is a dependency bump. The invariant we are adopting:

> **A project's copied surface must equal its genuinely custom code.**
> Everything load-bearing arrives through a version bump.

Consequences we are accepting up front:

- `templates/dmc` and `apps/dev` are **deleted**. They are stale forks of the
  same surface (we only use `templates/operator`), and they are the first
  victims of the model this RFC removes.
- **Fork-and-own is retired entirely — including the source-installed
  (registry) UI strategy.** There are exactly two ways to consume Voyant:
  build on it (manifest + extension points + imported `@voyantjs/ui` /
  `*-ui` packages) or fork the repository and own everything. No partial
  forks via copied files or registry-installed component source. `*-ui`
  packages become ordinary versioned dependencies; the shadcn-style registry
  (`apps/registry`, per-package `registry/` dirs) is removed.
- `admin-architecture.md` Rule 2 ("keep the final admin shell template-owned")
  is **superseded**, and so are Rules 8–9 (the source-installed UI block
  layer): the shell becomes framework-owned; projects own composition via
  config and extensions, not via copied shell or component code.
- No template-upgrade/codemod tooling. We are going straight to the packaged
  model; the template that remains is thin enough that "upgrading" it is not a
  meaningful operation.

---

## 1. The problem: template-delivered infrastructure cannot receive fixes

### 1.1 Two delivery models for one product

When a fix spans a package and the template, downstream projects get exactly
half of it:

| Change (from #1638) | Lives in | Downstream delivery |
| --- | --- | --- |
| CORS preflight fix | `@voyantjs/hono` | ✅ version bump |
| Lean `/api/auth/*` dispatch | template `entry.ts` / `hono-api-dispatch.ts` | ❌ hand-port |

A missed hand-port is invisible until it breaks, and template code is exactly
the load-bearing infrastructure (auth dispatch, cold-start chunking, SSR
preload policy) where a miss is severe. #1636 was a hard production outage.

### 1.2 The fork tax compounds per project

Every client project re-pays the port cost for every template fix, forever.
This actively discourages keeping projects current — each upgrade is manual
surgery on diverged files — which means the gap between "what Voyant ships"
and "what deployments run" only grows. For enterprise projects, where
stability and a credible upgrade story are procurement requirements, this is
disqualifying.

### 1.3 We are our own first victim

`templates/dmc` and `apps/dev` are in-repo forks of the same admin surface
(`apps/dev` overlaps `templates/dmc` by ~60–70% with dozens of extra diverged
routes). Fixes landed in one and missed the others routinely. The repo
demonstrates the failure mode before any client does.

---

## 2. Principles

1. **One delivery model.** Framework-owned code ships in versioned packages —
   frontend and worker infrastructure included, not just backend modules.
2. **Copied surface = custom code.** If a file in a project is not custom
   business logic or custom UI, it should not exist in the project.
3. **Extension points before overrides.** Customization flows through typed,
   sanctioned seams (routes, navigation, widget slots, component overrides).
   Overriding a framework-owned page is an explicit, registered act — never
   silent file divergence.
4. **Two consumption modes, nothing in between.** Build on Voyant (manifest +
   extensions + imported UI packages, everything upgradeable) or fork the
   repository and own the whole stack. A partial fork — copied template
   files, registry-installed component source — combines the upgrade story of
   a fork with the expectations of a dependency, and is exactly what produced
   the incident class in §1. It is no longer a supported mode.
5. **The manifest drives composition.** `voyant.config.ts` already lists
   modules/plugins and is becoming the source of truth for migrations
   (migration-resilience RFC). The admin reads from the same composition: the
   modules you mount determine the pages, nav, and widgets you get.
6. **The admin is a product surface, not a starter.** It has a version, a
   changelog, and a compatibility contract — like every other package.

---

## 3. Current state: most of the machinery already exists

What we have (and is already exercised in `templates/operator`):

- **`@voyantjs/admin`** — shell primitives, providers (query/theme/locale/i18n),
  navigation resolution, dashboard page, and the extension system:
  `AdminExtension`, `defineAdminExtension()`, `createAdminExtensionRegistry()`,
  `resolveAdminNavigation()`, `resolveAdminWidgets()`, `AdminWidgetSlot`.
- **Live extension usage** — `templates/operator/src/lib/admin-extensions.tsx`
  registers three extensions (promotions, travel-composer, action-ledger) that
  contribute navigation and routes, and 8 widget slots are defined
  (`dashboard.*`, `booking.details.*`, `invoice.details.*`) with renderers in
  the booking and invoice detail pages.
- **42 `@voyantjs/*-react` / `*-ui` packages** already imported by the
  operator — the domain UI largely lives in packages; the template wraps it
  in locally-owned pages.
- **`voyant.config.ts`** — manifest with `admin: { enabled, path }`, the
  module list, plugins, and feature flags; `composeFromManifest(...)` already
  drives backend composition.
- **Typed admin API surface** — ADR-0003's `admin-contracts` / `admin-client`.

What is missing — the actual gap this RFC closes:

- **Nobody owns the route tree but the template.** Extensions can declare
  route *metadata*, but the 103 route files and the TanStack Router tree are
  template-local. A package cannot ship a page.
- **The shell composition is template code.** Providers, auth flows, nav
  shell, and layout wiring are copied per project.
- **Worker dispatch and build config are copied files**, not package exports.

---

## 4. Design

### 4.1 `createAdminApp` — the admin as a package-owned application

`@voyantjs/admin` (or a new `@voyantjs/admin-app` if we want to keep the
primitives package lean) exports a factory that owns the entire application:

```ts
// src/admin/index.ts in a project — illustrative, not final API
import { createAdminApp } from "@voyantjs/admin-app";
import { bookingsAdmin } from "@voyantjs/bookings-ui/admin";
import { catalogAdmin } from "@voyantjs/catalog-ui/admin";
// ... one import per mounted domain
import { customExtensions } from "./extensions";

export const admin = createAdminApp({
  basePath: "/app",
  extensions: [bookingsAdmin, catalogAdmin /* ... */, ...customExtensions],
  branding: { name: "Acme Travel", logo: AcmeLogo },
  navigation: { /* optional ordering / grouping overrides */ },
  locale: { default: "en" },
});
```

The factory owns: the route tree, the auth flows (sign-in/up, reset, invites,
onboarding — today ~8 copied route files backed by `@voyantjs/auth-ui`), the
provider stack, the nav shell, error/loading boundaries, and the dashboard.
All of it versioned, none of it copied.

### 4.2 Packages ship pages: route contributions become real components

`AdminExtension` grows from route *metadata* to route *implementations*:

```ts
// inside @voyantjs/bookings-ui
export const bookingsAdmin = defineAdminExtension({
  id: "bookings",
  navigation: [{ to: "/bookings", label: "Bookings", icon: CalendarCheck, order: 20 }],
  routes: [
    { path: "/bookings", component: BookingListPage },
    { path: "/bookings/$bookingId", component: BookingDetailPage },
  ],
  widgets: [/* contributions into other domains' slots */],
});
```

**Routing mechanics.** File-based routing cannot express package-contributed
pages, so `createAdminApp` assembles a **code-based TanStack Router tree** from
the extension list. TanStack Router supports this fully; we trade file-based
codegen for config-driven assembly — which is the entire point. A build-time
generation step (a Vite plugin emitting a typed route tree from the resolved
extension list, restoring fully typed `Link`s across packages) is a Phase-2+
optimization, not a prerequisite.

**SSR/preload policy** (the #1642 class of fix) moves inside the factory: the
package knows the active route set because it built the tree.

### 4.3 Navigation and widgets: the existing seam becomes the only path

Nothing new to design — `resolveAdminNavigation` and `AdminWidgetSlot` exist
and work. The change is policy: the template's hand-rolled sidebar and nav
constants are deleted; navigation is the merge of extension contributions plus
the project's `navigation` overrides in `createAdminApp`. Widget slots stay
intentional and few (per `admin-architecture.md` Rule 7) but the slot catalog
becomes a documented, versioned contract of the admin package.

### 4.4 Worker runtime and build preset become packages

Directly per voyant#1641's suggested directions:

- **`@voyantjs/worker-runtime`** (or an export of `@voyantjs/hono`):
  `createWorkerFetch({ ssrHandler, authApp, apiApp, workflowPaths })` — the
  current `hono-api-dispatch.ts` (97 LOC) plus the dispatch parts of
  `entry.ts` (287 LOC). A project's `entry.ts` becomes bindings + factory
  call, ~30 lines.
- **`@voyantjs/vite-config`**: `voyantAdminPreset()` carrying the manual-chunk
  / cold-start tuning and SSR preload configuration. A project's
  `vite.config.ts` becomes preset + project-specific additions.

These two are independent of everything else in this RFC, are small, and would
have prevented the #1636 incident class outright. They go first (Phase 0).

### 4.5 The customization model (what enterprises get instead of a fork)

In order of preference, all typed and all upgrade-safe:

1. **Config** — branding, locale, nav ordering/grouping, feature toggles via
   `createAdminApp` options and `voyant.config.ts`.
2. **Widget slots** — inject cards/panels/actions into the documented slots.
3. **Custom extensions** — full custom pages + nav entries via
   `defineAdminExtension` in project code (`src/admin/`), exactly like the
   operator's promotions/trips/action-ledger extensions today.
4. **Component overrides** — a registered override map for specific
   framework-owned pages or blocks (`overrides: { "bookings.detail": MyPage }`).
   This is the escape hatch: explicit, named, visible in one place, and
   greppable when upgrading — the opposite of silent file divergence. An
   override is built the same way framework pages are built: by composing the
   exported components, hooks, and primitives of `@voyantjs/ui` and the
   domain `*-react` / `*-ui` packages — not by copying their source. If the
   exported surface is not rich enough to build a needed override, that is a
   gap in the package's public API and gets fixed there, where the fix
   benefits every project.

### 4.6 What a project looks like after

```
acme-travel/
  voyant.config.ts          # modules, plugins, admin config — the manifest
  wrangler.jsonc            # bindings
  vite.config.ts            # voyantAdminPreset() + ~nothing
  src/
    entry.ts                # createWorkerFetch(...) — thin wiring
    api/app.ts              # createApp / composeFromManifest — already thin
    admin/
      index.ts              # createAdminApp({ extensions, branding, ... })
      extensions/           # custom pages, widgets, overrides (CUSTOM CODE)
  drizzle/                  # migrations (per migration-resilience RFC)
```

Every file is either the manifest, thin wiring, or genuinely custom code.
A dispatch fix, a cold-start fix, a new bookings page, an admin shell fix —
all arrive with `pnpm update`.

---

## 5. What we delete

- **`templates/dmc`** — superseded fork; we only use `templates/operator`.
- **`apps/dev`** — near-duplicate of dmc with extra diverged routes. Its role
  (UI playground against a real DB) is taken over by the thinned
  `templates/operator`, which becomes both the reference host and the proving
  ground: if the operator's local pages can't be expressed through the
  extension surface, neither can a client's.
- **The shadcn-style registry** — `apps/registry` (the registry host worker),
  the `registry/` directories inside `*-ui` packages, and the
  `registry:build` tooling. `*-ui` packages are consumed as ordinary
  versioned dependencies with a public component/export surface. Projects
  that want source-level ownership fork the repository.

`templates/operator` survives as the reference host and the `voyant new`
scaffold source — but its `src/` shrinks from ~40k LOC toward the §4.6 shape.

---

## 6. Phased plan

### Phase 0 — package the worker runtime + build preset (incident-class fix)

Extract `createWorkerFetch` and `voyantAdminPreset`; operator consumes both.
Small, independent, immediately closes the #1636/#1638 delivery gap for the
most load-bearing files. No admin UI changes.

### Phase 1 — `createAdminApp` owns shell, providers, auth, navigation

The factory renders the shell + auth flows + nav from the extension registry;
operator deletes its copied providers/nav/auth route files and mounts the
factory. Domain routes remain template-local behind a transitional
`localRoutes` option — the tree is assembled by the package either way.

### Phase 2 — packages ship pages; pilot one domain

Extend `AdminExtension` routes to carry components; pilot with a domain whose
UI already lives in packages (catalog or promotions — promotions is already
extension-shaped). Validate: code-based route tree, SSR preloads, typed
navigation, i18n bundle merging.

### Phase 3 — migrate all domains; delete the forks

Move the remaining domain pages from `templates/operator/src/components/voyant`
+ `src/routes` into their `*-ui` packages' admin extensions, one domain per
PR. When the operator's local routes are only genuinely custom pages, delete
`templates/dmc`, `apps/dev`, and the registry (`apps/registry` + per-package
`registry/` dirs + `registry:build` tooling).

### Phase 4 — contract hardening

Versioning policy (peer ranges between the admin app package and `*-ui`
admin extensions; changesets already in place), the documented widget-slot and
override catalogs, and revision of `admin-architecture.md` (§7).

---

## 7. Revisions to existing guidance

`admin-architecture.md` Rule 2 ("Keep the final admin shell template-owned")
is superseded: the shell is framework-owned; projects own **composition**
(config + extensions + overrides), not shell code. Rules 8–9 (the
source-installed UI block layer and the registry strategy) are also
superseded: there is no source-installed layer anymore; `*-ui` packages are
imported, not copied. Rules 4–7 (explicit extension points, narrow nav
contributions, selective widget slots) are unchanged and become load-bearing —
they are the customization surface that replaces forking.

`frontend-package-strategy.md` is revised accordingly: the "shadcn registry
blocks" layer is retired; the remaining layers are domain packages,
framework-agnostic SDKs, `*-react` runtime packages, and `*-ui` component
packages consumed as dependencies.

The "Non-Goals" caveat against "a fully closed admin product" still holds:
§4.5's override registry is the explicit escape hatch that keeps the admin
open without reintroducing silent divergence — and a full repository fork
remains available to anyone who genuinely wants to own the stack.

---

## 8. Decisions made & open questions

Decided:

- No template-upgrade/codemod tooling — straight to the packaged model.
- `templates/dmc` and `apps/dev` are deleted (Phase 3).
- Fork-and-own is retired, including the shadcn-style registry
  (`apps/registry` + per-package `registry/` source). Build on Voyant via
  extensions + imported packages, or fork the repository — nothing between.
- Code-based route assembly first; build-time typed-tree generation later.
- The existing `AdminExtension` seam is the foundation — extended, not replaced.

Open:

1. **Package shape:** grow `@voyantjs/admin` into the app factory, or keep it
   as primitives and add `@voyantjs/admin-app`? (Leaning: separate package, so
   the primitives stay consumable by non-standard hosts.)
2. **Typed links across packages:** how much route-path type safety do we
   accept losing in Phase 2 before the generated tree lands?
3. **Auth route ownership:** the auth flows are framework-owned in §4.1 —
   confirm `@voyantjs/auth-ui` covers all current operator auth routes
   (incl. accept-invite/onboarding) or extend it first.
4. **Storefront routes:** `templates/operator` also hosts `(storefront)/*`
   pages. Same model eventually (a `createStorefrontApp`), but explicitly out
   of scope for this RFC.
5. **i18n:** merge strategy for extension-contributed admin locale bundles
   (the `catalogBrowser` namespace pattern suggests per-extension namespaces).
6. **Admin version ↔ module version compatibility:** do `*-ui` admin
   extensions declare a peer range on the admin app package only, or also on
   their backend module (so a page never renders against an API surface that
   lacks its endpoints)?

---

## 9. Success criteria

1. A fix of the #1636/#1638 class (dispatch, chunking, preloads, shell, auth
   flow, domain page) ships to every project as a version bump. Zero
   hand-ports.
2. A new project scaffold contains no framework infrastructure: manifest,
   thin entries, empty `src/admin/extensions/`.
3. `templates/operator/src/routes` + `src/components` shrink from ~41k LOC to
   only genuinely custom pages (target: under ~3k LOC).
4. `templates/dmc` and `apps/dev` no longer exist.
5. An enterprise customization (new page, injected widget, overridden detail
   page) is expressible without modifying any framework-owned file.
6. No source-installed component copies remain: `apps/registry` and the
   `registry/` directories are gone, and every `*-ui` consumer imports the
   package instead of owning a copy of its source.
