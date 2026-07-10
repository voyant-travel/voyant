# @voyant-travel/operator-settings-react

## 0.4.0

### Patch Changes

- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
  - @voyant-travel/finance@0.151.0
  - @voyant-travel/finance-react@0.151.0
  - @voyant-travel/admin-app@0.43.0

## 0.3.0

### Patch Changes

- @voyant-travel/finance@0.150.0
- @voyant-travel/finance-react@0.150.0
- @voyant-travel/admin-app@0.42.0

## 0.2.0

### Minor Changes

- b13f028: Add `@voyant-travel/operator-settings-react` — the source-free React UI for the
  **Operator Profile** settings page, the packaged companion to the API-only
  `@voyant-travel/operator-settings` (voyant#3061, under #2983).

  The page edits the operator's contract identity (trading name, legal name, VAT
  id, trade-register number, contact, license, signatory, payment
  instructions/collection defaults, checkout links) that populates `operator.*`
  in contract templates, reading and writing the `/v1/admin/settings/operator-*`
  routes already mounted on the managed runtime. It resolves its API surface from
  the admin runtime context and its copy from the shared operator admin messages,
  so a package-only, source-free admin can mount it with no starter source.

  `@voyant-travel/operator-settings-react/settings` exports
  `createOperatorProfileSettingsExtraPage()`, an `AdminCoreSettingsExtraPage`
  descriptor to spread into
  `createAdminCoreExtension({ settings: { extraPages: [...] } })`; the root exports
  the `OperatorProfileSettingsPage` component. The managed-operator host mounts it
  (closing the last GENERAL settings gap for managed profiles), and the operator
  starter adopts it in place of its former app-custom page.

### Patch Changes

- Updated dependencies [a97e845]
  - @voyant-travel/admin@0.120.0
  - @voyant-travel/admin-app@0.41.0
  - @voyant-travel/finance-react@0.149.0
  - @voyant-travel/finance@0.149.0
