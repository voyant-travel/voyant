# Storefront Settings

`@voyant-travel/storefront` exposes public settings reads and admin settings
read/update routes for operator storefront configuration.

## Routes

Mount `createStorefrontApiModule(...)` to get:

- `GET /v1/public/settings`
- `GET /v1/admin/storefront/settings`
- `PATCH /v1/admin/storefront/settings`

Public reads continue to resolve through `resolveSettings`. Admin writes call
the optional `updateSettings` callback, so deployments can keep their existing
settings store while using Voyant's route, validation, and React/UI contract.

```ts
createStorefrontApiModule({
  resolveSettings: ({ env }) => loadStorefrontSettings(env),
  updateSettings: async (settings, { env }) => {
    await saveStorefrontSettings(env, settings)
    return settings
  },
})
```

The admin PATCH body accepts partial section updates for `branding`, `support`,
`legal`, `localization`, `payment`, and `forms`. Omitted section fields preserve
their current value. URL fields must use HTTP or HTTPS, brand colors must use
`#RGB` or `#RRGGBB`, payment deposits are constrained to `0..100`, and bank
transfer settings contain display details only.

## React And UI

Use `@voyant-travel/storefront-react` for admin settings hooks:

```tsx
const settings = useAdminStorefrontSettings()
const mutation = useAdminStorefrontSettingsMutation()
```

Use `@voyant-travel/storefront-react/ui` for the operator-facing settings page:

```tsx
import { StorefrontSettingsPage } from "@voyant-travel/storefront-react/ui"

export function SettingsRoute() {
  return <StorefrontSettingsPage />
}
```

The page expects the app to provide the normal Voyant React provider and React
Query client used by other operator UI packages.
