# @voyant-travel/operator-settings-react

Source-free React UI for the **Operator Profile** settings page — the packaged
companion to the API-only `@voyant-travel/operator-settings`.

The page edits the operator's legal-entity/contract identity (trading name,
legal name, VAT id, trade-register number, contact, license, signatory, payment
instructions/collection defaults, and checkout links) that populates
`operator.*` in contract templates. It reads and writes the
`/v1/admin/settings/operator-*` routes that `@voyant-travel/operator-settings`
mounts on the runtime.

It resolves its API surface from the admin runtime context
(`useVoyantReactContext`) and its copy from the shared operator admin messages
(`useOperatorAdminMessages`), so a **package-only, source-free admin** (e.g. the
managed operator host) can render it without importing any starter source.

## Usage

```tsx
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import { createOperatorProfileSettingsExtraPage } from "@voyant-travel/operator-settings-react/settings"

createAdminCoreExtension({
  settings: {
    extraPages: [createOperatorProfileSettingsExtraPage()],
  },
})
```

`createOperatorProfileSettingsExtraPage()` returns an
`AdminCoreSettingsExtraPage` descriptor placed in the General settings group
(leading order `10`, Building icon). The page component itself is exported from
the package root as `OperatorProfileSettingsPage` for direct mounting.

## License

Apache-2.0
