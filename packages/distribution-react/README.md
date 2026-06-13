# @voyantjs/distribution-react

The distribution client tier: headless data hooks/clients plus the styled UI
components and page-level compositions (formerly `@voyantjs/distribution-ui`).
Supplier and external-reference UI owner paths live in this package under
`./suppliers` and `./external-refs`; old `@voyantjs/suppliers-react` and
`@voyantjs/external-refs-react` package names are compatibility facades.

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose heavier peers
(`@voyantjs/ui`, `@tanstack/react-table`) are optional and only needed when
you import those subpaths.

## Install

```bash
pnpm add @voyantjs/distribution-react @voyantjs/distribution @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantDistributionProvider, useChannels } from "@voyantjs/distribution-react"

function App() {
  return (
    <VoyantDistributionProvider baseUrl="/api">
      <ChannelsList />
    </VoyantDistributionProvider>
  )
}

function ChannelsList() {
  const { data } = useChannels()
  return <>{data?.data.map((channel) => <div key={channel.id}>{channel.name}</div>)}</>
}
```

## UI components

Importable React UI components for Voyant distribution. Bundler-consumed (Vite, Next.js, webpack, etc.).

```bash
pnpm add @voyantjs/distribution-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives; it is an optional peer
required only when importing the styled subpaths.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

### I18n

Components render English by default. To localize them, wrap your UI in
`DistributionUiMessagesProvider` and import only the locales your app supports.

```tsx
import { DistributionUiMessagesProvider } from "@voyantjs/distribution-react/ui"
import { distributionUiEn } from "@voyantjs/distribution-react/i18n/en"
import { distributionUiRo } from "@voyantjs/distribution-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

### Components

- `DistributionPage`, `DistributionOverview`
- `ChannelsPage`, `ChannelSyncPage`
- `ChannelDetailPage`, `ContractDetailPage`, `CommissionRuleDetailPage`, `MappingDetailPage`, `BookingLinkDetailPage`, `WebhookEventDetailPage`
- `DistributionChannelsTab`, `DistributionContractsTab`, `DistributionCommissionsTab`
- `DistributionMappingsTab`, `DistributionBookingLinksTab`, `DistributionWebhooksTab`
- Supplier UI: `@voyantjs/distribution-react/suppliers`, `/suppliers/ui`, `/suppliers/admin`
- External refs UI: `@voyantjs/distribution-react/external-refs`, `/external-refs/ui`

### Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `distribution-dialogs-commercial`, `distribution-dialogs-commission`, `distribution-dialogs-sync`, `distribution-dialogs-webhook`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

## License

Apache-2.0
