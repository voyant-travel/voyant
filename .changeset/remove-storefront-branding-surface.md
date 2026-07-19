---
"@voyant-travel/storefront": minor
"@voyant-travel/storefront-react": minor
"@voyant-travel/storefront-sdk": minor
"@voyant-travel/operator-settings-react": minor
"@voyant-travel/i18n": minor
"@voyant-travel/legal": minor
---

Remove the redundant singular storefront branding admin surface and make the
organization (operator) profile the single home for org brand identity.

Storefronts are plural (many per org, managed under the top-level "Storefronts"
surface). The leftover singular "storefront" Settings page edited a separate
branding blob (logo/favicon/brand mark/colors/languages) that duplicated brand
identity already modeled on the operator profile. Per-storefront visuals are a
developer's frontend concern, not an admin one, so the surface and its storage
schema are dropped.

- storefront: drop the module `admin` block (branding settings page + branding
  setup step) and remove the `branding` shape from the storefront settings
  schema, service, admin/public routes, and OpenAPI documents. No database
  migration is required — storefront branding was never persisted to a table;
  it lived only in static deployment settings.
- storefront-react / storefront-sdk: remove `createSelectedStorefrontAdminExtension`,
  the storefront settings page/form, and the `./admin`, `./ui`, and
  `./components/storefront-settings-page` package exports. `StorefrontSettingsRecord`
  and the settings schemas no longer carry `branding`.
- operator-settings-react / i18n / legal: rename the user-facing "Operator
  profile" label to "Organization" ("Organizație" in Romanian) across the
  settings nav, page title, saved-toast copy, and contract template-authoring
  descriptions. The API path, `operator_profile` table, ids, and query keys are
  unchanged.
