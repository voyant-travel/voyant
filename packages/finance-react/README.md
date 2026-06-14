# @voyant-travel/finance-react

The finance client tier: headless data hooks/clients plus the styled UI
primitives and page-level compositions (formerly `@voyant-travel/finance-ui`).

Headless consumers (portals, custom apps) import from the root, `./hooks`,
`./client`, or `./query-keys` — these pull no styling peers. Styled surfaces
live under `./ui`, `./components/*`, `./admin`, `./i18n`, and `./styles.css`,
whose heavier peers (`@voyant-travel/ui`, `@voyant-travel/admin`,
`@tanstack/react-table`, `sonner`, `recharts`, `react-hook-form`) are optional
and only needed when you import those subpaths.

## Install

```bash
pnpm add @voyant-travel/finance-react @voyant-travel/ui @tanstack/react-query react react-dom
```

`@voyant-travel/ui` provides the design-system primitives (required only for the
styled subpaths). The root export and `./hooks` provide the data-layer hooks.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Detail Section Replacement Slots

`InvoiceDetailPage` exposes `*Content` slots for replacing built-in list
sections while keeping the surrounding detail page and append-only `after*`
slots. Use `lineItemsContent`, `paymentsContent`, `creditNotesContent`,
`attachmentsContent`, or `notesContent` when an app needs fully custom inline
management controls for that section.

`integrationsContent` is the dedicated invoice integration mount point. It is
rendered immediately after the invoice summary cards and may be either a React
node or a render function that receives `{ invoice }`. Provider plugins can
mount one or more external-reference panels there without replacing core invoice
sections.

## Components

- `InvoicesPage`, `InvoiceDetailPage`, and `PaymentsPage` publish
  list/detail-management compositions.
- `TaxesPage` publishes the finance-owned tax class, tax regime, and tax policy
  profile settings composition. It reads `baseUrl` and `fetcher` from
  `VoyantFinanceProvider`; pass the `api` prop only when an app needs a custom
  transport adapter.
- `InvoiceDetailHeader`, `InvoiceSummaryCard`, `InvoiceLinksCard`,
  `InvoiceLineItemsCard`, `InvoicePaymentsCard`, `InvoiceCreditNotesCard`, and
  `InvoiceNotesCard` remain exported for consumers that need to compose the
  invoice detail page manually.
- `PaymentDetailPage` publishes the customer/supplier payment detail
  workspace with summary, related record, and metadata cards.
- `PaymentDetailHeader`, `PaymentSummaryCard`, `PaymentLinksCard`, and
  `PaymentMetadataCard` remain exported for consumers that need to compose the
  detail page manually.

## Checkout UI

Finance React owns checkout hooks and payment collection UI under
`@voyant-travel/finance-react/checkout` and `@voyant-travel/finance-react/checkout-ui`.
The legacy `@voyant-travel/checkout-react` workspace package has been removed from
the v1 branch; use the Finance React owner paths directly.

## I18n

Components render English by default. To localize them, wrap your UI in
`FinanceUiMessagesProvider` and import only the locales your app supports.

```tsx
import { FinanceUiMessagesProvider } from "@voyant-travel/finance-react/ui"
import { financeUiEn } from "@voyant-travel/finance-react/i18n/en"
import { financeUiRo } from "@voyant-travel/finance-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.
