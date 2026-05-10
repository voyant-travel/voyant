# @voyantjs/distribution-ui

Importable React UI components for Voyant distribution. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/distribution-ui @voyantjs/distribution-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/distribution-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`DistributionUiMessagesProvider` and import only the locales your app supports.

```tsx
import { DistributionUiMessagesProvider } from "@voyantjs/distribution-ui"
import { distributionUiEn } from "@voyantjs/distribution-ui/i18n/en"
import { distributionUiRo } from "@voyantjs/distribution-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

## Components

- `DistributionPage`, `DistributionOverview`
- `ChannelsPage`, `ChannelSyncPage`
- `ChannelDetailPage`, `ContractDetailPage`, `CommissionRuleDetailPage`, `MappingDetailPage`, `BookingLinkDetailPage`, `WebhookEventDetailPage`
- `DistributionChannelsTab`, `DistributionContractsTab`, `DistributionCommissionsTab`
- `DistributionMappingsTab`, `DistributionBookingLinksTab`, `DistributionWebhooksTab`

## Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `distribution-dialogs-commercial`, `distribution-dialogs-commission`, `distribution-dialogs-sync`, `distribution-dialogs-webhook`. Import via `npx shadcn add @voyant/<component>` and customize per-project.
