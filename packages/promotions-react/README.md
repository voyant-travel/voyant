# @voyantjs/promotions-react

The promotions client tier: headless data hooks/clients plus the styled UI
components and admin page composition (formerly `@voyantjs/promotions-ui`).

Headless consumers import from the root — it pulls no styling peers. Styled
surfaces live under `./ui`, `./components/*`, `./admin`, and `./i18n`, whose
heavier peers (`@voyantjs/ui`, `@voyantjs/admin`) are optional and only needed
when you import those subpaths.

## UI components

- `PromotionsPage` — operator-facing promotions list page with server-backed
  search, filters, and pagination. `loadPromotionsPage` prefetches its data
  for SSR/loaders.
- `PromotionDialog` — create/edit dialog for a promotional offer, including
  the discriminated-union scope picker.
- `createPromotionsAdminExtension` (from `./admin`) — the packaged admin
  contribution: nav entry plus the full route implementation per the
  packaged-admin RFC Phase 2.

## I18n

The package exports `PromotionsUiMessagesProvider`, `promotionsUiEn`, and
`promotionsUiRo` from `@voyantjs/promotions-react/i18n`. Components fall back
to English when no provider is mounted.
