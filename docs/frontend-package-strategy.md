# Frontend Package Strategy

> Note (2026-06): shadcn registry blocks have been retired — the registry source,
> `apps/registry`, and `registry:build` were deleted per
> `docs/architecture/packaged-admin-rfc.md` §5. Domain UI now ships through
> React runtime packages and surface packages such as `admin` / `storefront`.
> Separate `*-ui` packages are no longer a target package layer; reusable module
> components live in the corresponding `*-react` package.

Voyant separates frontend acceleration into three layers:

1. `@voyantjs/<module>`
   Domain and runtime logic. These packages stay transport- and framework-agnostic where possible.
2. Framework-agnostic SDK packages when a cross-module public workflow needs a
   stable client facade, for example `@voyantjs/storefront-sdk`.
3. `@voyantjs/<module>-react`
   React runtime helpers and reusable module UI for a module. These packages
   provide hooks, query keys, typed clients, providers, frontend view-model
   helpers, and reusable components that are not specific to one app shell.

`admin`, `storefront`, and app/template packages own shell composition,
navigation, page assembly, and deployment-specific presentation.

## Why This Split Exists

Starter apps should not force developers to build every screen from the raw domain package surface. A developer who adds relationships, quotes, bookings, products, or finance should have a fast path:

1. install the domain module
2. install the React runtime package for that module
3. compose final pages inside `admin`, `storefront`, or the app/template

That gives Voyant a better product shape than a monolithic starter-only UI and avoids turning every backend/domain package into a React-specific dependency.

## Naming Rules

- Domain/runtime packages keep simple names like `@voyantjs/relationships`, `@voyantjs/quotes`, `@voyantjs/bookings`, `@voyantjs/products`.
- React packages use `-react`, for example `@voyantjs/relationships-react`.
  They own hooks, clients, providers, view-model helpers, and reusable module
  components.
- Shared physical-place UI should use `@voyantjs/places-react` and place-first
  names such as `PlaceCombobox` / `PlaceBadge`. `@voyantjs/facilities-react`
  remains a compatibility import while `facilityId` public fields migrate.
- Do not create new `*-ui` packages. If a historical `*-ui` package exists,
  fold it into the corresponding `*-react` package as part of v1 cleanup.
- Surface packages such as `admin` and `storefront` own page assembly and should
  not be replaced by domain React packages.

## What Belongs In `-react`

- Context providers
- typed fetch clients for module-local contracts, or React Query wrappers around
  a framework-agnostic SDK when a workflow spans modules
- React Query hooks
- mutation hooks
- query key helpers
- frontend-oriented schemas and record types
- cards
- tables
- dialogs
- forms
- detail panes
- filter bars
- page sections and module-specific UI building blocks

Do not put a single app-specific screen in a module React package. Keep that in
the surface/app package until a reusable component Interface exists.

## Tailwind v4 Package Styles

Packages that render Tailwind classes from shipped component code must expose a
CSS helper at `@voyantjs/<package>/styles.css`. Consumers should import only the
helpers for packages they install, for example:

```css
@import "@voyantjs/ui/styles.css";
@import "@voyantjs/admin/styles.css";
@import "@voyantjs/bookings-react/styles.css";
```

`@voyantjs/ui/styles.css` is the canonical base import and includes the shared
Voyant UI globals. Domain UI helpers such as
`@voyantjs/bookings-react/styles.css` and `@voyantjs/availability-react/styles.css`
only expose Tailwind source-detection directives for package components.

## What Does Not Belong In `-react`

- core business rules already owned by `@voyantjs/<module>`
- deployment-specific route trees
- app shell navigation
- starter-specific theming and layout

## Module UI Migration

The old combined customer-and-sales surface is split before v1:

- `@voyantjs/relationships` and `@voyantjs/relationships-react` own people,
  organizations, activities, profile context, documents, and customer signals.
- `@voyantjs/quotes` and `@voyantjs/quotes-react` own pipelines, stages,
  quotes, quote versions, and proposal lifecycle UI.

Future module candidates should add `-react` only when they justify reusable
React runtime helpers or reusable module components. Not every Module needs a
React package immediately.

Inventory is one of those justified module React packages:
`@voyantjs/inventory-react` is the operated product authoring UI target for
Product structure, Product Versions, product-internal components, and owned
publication lifecycle. `@voyantjs/products-react` remains a compatibility
entrypoint until the v1 physical move is complete; new operated-authoring
surfaces should be added under Inventory React.
