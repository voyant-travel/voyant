---
"@voyant-travel/admin": minor
---

Complete the runtime admin route/navigation composition so a source-free host
(no generated route module) works end to end (voyant#3044).

- `buildAdminExtensionRoutes` now builds and attaches a layout contribution's
  nested `children` (e.g. core `/settings/*`) — previously only top-level
  contributions were created, so deep links like `/settings/channels` landed on
  not-found.
- New `buildAdminExtensionDestinations(extensions)` derives the semantic
  destination resolver map from the registry's route bindings at runtime (the
  analogue of `voyant admin generate --destinations`), so packaged pages'
  `useAdminHref` / `useAdminNavigate` resolve instead of falling back to `#`.
- `AdminNavigationProvider.resolvers` and `AdminWorkspaceShell.destinations`
  are now `Partial<AdminDestinationResolvers>` — honest, since the provider
  already falls back to `#` for any unbound key (resolvers needing more than
  path interpolation stay host-owned). Full maps remain assignable.
