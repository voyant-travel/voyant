# Frontend Package Strategy

> Note (2026-06): layer 4 (shadcn registry blocks) has been retired — the registry source, `apps/registry`, and `registry:build` were deleted per `docs/architecture/packaged-admin-rfc.md` §5. Domain UI now ships only as versioned `*-ui` packages; registry references below are historical.

Voyant separates frontend acceleration into three layers:

1. `@voyantjs/<module>`
   Domain and runtime logic. These packages stay transport- and framework-agnostic where possible.
2. Framework-agnostic SDK packages when a cross-module public workflow needs a
   stable client facade, for example `@voyantjs/storefront-sdk`.
3. `@voyantjs/<module>-react`
   React runtime helpers for a module. These packages provide hooks, query keys, typed clients, providers, and frontend view-model helpers.
4. shadcn registry blocks
   Source-installed UI components and screens that developers can pull into their own app and customize locally.

## Why This Split Exists

Starter apps should not force developers to build every screen from the raw domain package surface. A developer who adds CRM, bookings, products, or finance should have a fast path:

1. install the domain module
2. install the React runtime package for that module
3. add the UI blocks they want from the registry
4. customize those local source files as needed

That gives Voyant a better product shape than a monolithic starter-only UI and avoids turning every backend/domain package into a React-specific dependency.

## Naming Rules

- Domain/runtime packages keep simple names like `@voyantjs/crm`, `@voyantjs/bookings`, `@voyantjs/products`.
- React runtime packages use `-react`, for example `@voyantjs/crm-react`.
- Registry content stays source-installable and should depend on the relevant `-react` package rather than re-implementing runtime hooks.

## What Belongs In `-react`

- Context providers
- typed fetch clients for module-local contracts, or React Query wrappers around
  a framework-agnostic SDK when a workflow spans modules
- React Query hooks
- mutation hooks
- query key helpers
- frontend-oriented schemas and record types

## What Belongs In The Registry

- cards
- tables
- dialogs
- forms
- detail panes
- filter bars
- page sections and module-specific UI building blocks

## Tailwind v4 Package Styles

Packages that render Tailwind classes from shipped component code must expose a
CSS helper at `@voyantjs/<package>/styles.css`. Consumers should import only the
helpers for packages they install, for example:

```css
@import "@voyantjs/ui/styles.css";
@import "@voyantjs/admin/styles.css";
@import "@voyantjs/bookings-ui/styles.css";
```

`@voyantjs/ui/styles.css` is the canonical base import and includes the shared
Voyant UI globals. Domain UI helpers such as
`@voyantjs/bookings-ui/styles.css` and `@voyantjs/availability-ui/styles.css`
only expose Tailwind source-detection directives for package components.

## What Does Not Belong In `-react`

- core business rules already owned by `@voyantjs/<module>`
- deployment-specific route trees
- app shell navigation
- starter-specific theming and layout

## CRM As The First Slice

CRM is the first module being moved into this shape:

- `@voyantjs/crm` remains the domain package
- `@voyantjs/crm-react` becomes the shared React runtime package
- `packages/ui/registry/crm/*` holds the shadcn registry source for CRM UI blocks

Future module candidates should follow the same pattern only when they justify a reusable React runtime layer. Not every module needs `-react` immediately.
