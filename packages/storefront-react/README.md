# @voyantjs/storefront-react

The storefront client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyantjs/storefront-ui`).

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, and `./styles.css`, whose heavier peers
(`@voyantjs/ui`, `lucide-react`) are optional and only needed when you import
those subpaths.

## Styled components

- `StorefrontSettingsPage` (`./components/storefront-settings-page` or the
  `./ui` barrel) — the admin storefront settings page: branding, support
  links, legal, and payment configuration backed by
  `useAdminStorefrontSettings` / `useAdminStorefrontSettingsMutation`.
