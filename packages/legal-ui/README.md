# @voyantjs/legal-ui

Importable React UI components for Voyant legal. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/legal-ui @voyantjs/legal-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/legal-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Detail Tab Replacement Slots

`ContractDetailPage` exposes `slots` for replacing built-in tab content while
keeping the default tab navigation. Use `detailsContent`, `partiesContent`,
`signaturesContent`, or `documentsContent` when an app needs custom inline
management controls instead of the shipped read-only table.

## Contract Dialog

`ContractDialog` provides the default create/edit form for `ContractsPage` and
`ContractDetailPage`. It owns contract setup, template and version selection,
number series, expiry, template variables, additional variables, metadata, and
submit wiring. Linked record pickers stay optional render props so apps can
wire CRM, supplier, or distribution selectors without `legal-ui` taking those
runtime dependencies.

```tsx
import { ContractDialog, ContractsPage } from "@voyantjs/legal-ui"

<ContractsPage
  renderContractDialog={(props) => (
    <ContractDialog
      {...props}
      renderPersonPicker={(pickerProps) => <PersonPicker {...pickerProps} />}
      renderOrganizationPicker={(pickerProps) => <OrganizationPicker {...pickerProps} />}
    />
  )}
/>
```

## I18n

Components render English by default. To localize them, wrap your UI in
`LegalUiMessagesProvider` and import only the locales your app supports.

```tsx
import { LegalUiMessagesProvider } from "@voyantjs/legal-ui"
import { legalUiEn } from "@voyantjs/legal-ui/i18n/en"
import { legalUiRo } from "@voyantjs/legal-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.
