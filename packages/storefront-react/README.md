# @voyant-travel/storefront-react

The storefront client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyant-travel/storefront-ui`).

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, and `./styles.css`, whose heavier peers
(`@voyant-travel/ui`, `lucide-react`) are optional and only needed when you import
those subpaths.

## Styled components

- `StorefrontSettingsPage` (`./components/storefront-settings-page` or the
  `./ui` barrel) — the admin storefront settings page: branding, support
  links, legal, and payment configuration backed by
  `useAdminStorefrontSettings` / `useAdminStorefrontSettingsMutation`.

## Customer buyer accounts

`CustomerAccountProvider` composes the customer-auth, portal, and buyer-account
providers. Storefronts can use `useBuyerAccounts`, `BuyerAccountSelector`, and
`BuyerAccountSelectionGate` from `@voyant-travel/storefront-react/storefront`
to support personal accounts, business accounts, or both.

See the
[storefront customer auth framework integration guide](https://github.com/voyant-travel/voyant/blob/main/docs/storefront-customer-auth-frameworks.md)
for Next.js and Astro SSR/BFF examples. Authentication stays cookie-backed and
same-origin; browser bundles never receive managed-runtime or provider secrets.
