---
"@voyantjs/auth-react": minor
"@voyantjs/availability-react": minor
"@voyantjs/booking-requirements-react": minor
"@voyantjs/bookings-react": minor
"@voyantjs/catalog-react": minor
"@voyantjs/charters-react": minor
"@voyantjs/checkout-react": minor
"@voyantjs/crm-react": minor
"@voyantjs/cruises-react": minor
"@voyantjs/distribution-react": minor
"@voyantjs/external-refs-react": minor
"@voyantjs/extras-react": minor
"@voyantjs/facilities-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/flights-react": minor
"@voyantjs/identity-react": minor
"@voyantjs/legal-react": minor
"@voyantjs/markets-react": minor
"@voyantjs/notifications-react": minor
"@voyantjs/pricing-react": minor
"@voyantjs/products-react": minor
"@voyantjs/promotions-react": minor
"@voyantjs/resources-react": minor
"@voyantjs/sellability-react": minor
"@voyantjs/storefront-react": minor
"@voyantjs/suppliers-react": minor
"@voyantjs/workflows-react": minor
---

Merge each module's `*-ui` package into its `*-react` sibling (#1652). The
`*-react` package is now the whole client tier: the headless exports (root,
`./hooks`, `./client`, `./provider`) are unchanged, and the styled tier moves
in under new subpaths — `./ui` (the old `*-ui` root barrel), `./components/*`,
`./admin`, `./i18n`, `./i18n/en`, `./i18n/ro`, and `./styles.css`.

Migration from `@voyantjs/<module>-ui`:

- `@voyantjs/<module>-ui` → `@voyantjs/<module>-react/ui`
- `@voyantjs/<module>-ui/<subpath>` → `@voyantjs/<module>-react/<subpath>`
- package.json: drop the `-ui` dependency; `-react` covers both tiers.

Styled-tier peers (`@voyantjs/ui`, `@voyantjs/admin`, `@tanstack/react-table`,
`sonner`, `react-hook-form`, sibling `*-react` hooks packages) are optional
peers — headless consumers that only import the root/`hooks`/`client` subpaths
do not need them. The 27 `@voyantjs/*-ui` packages are deprecated on npm in
favor of these subpaths; `@voyantjs/allocation-ui` and
`@voyantjs/workflow-runs-ui` (no `-react` sibling) are unaffected.
