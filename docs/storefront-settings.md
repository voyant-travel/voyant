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

The admin PATCH body accepts partial section updates for `support`, `legal`,
`localization`, `payment`, and `forms`. Omitted section fields preserve their
current value. URL fields must use HTTP or HTTPS, payment deposits are
constrained to `0..100`, and bank transfer settings contain display details
only.

Brand identity (logos, name, legal entity) is not a per-storefront admin
concern. An organization has one brand identity, modeled on the operator
profile (`@voyant-travel/operator-settings`, surfaced under Settings →
Organization). Per-storefront visuals are a developer's frontend concern when
building the storefront.

## React And UI

Use `@voyant-travel/storefront-react` for admin settings hooks:

```tsx
const settings = useAdminStorefrontSettings()
const mutation = useAdminStorefrontSettingsMutation()
```
