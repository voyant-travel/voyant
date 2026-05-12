# @voyantjs/crm-ui

Importable React UI components for Voyant CRM — person/organization cards, dialogs, lists, forms, and activity/opportunity dialogs. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/crm-ui @voyantjs/crm-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives (Button, Card, Dialog, etc.). `@voyantjs/crm-react` provides the data-layer hooks. Both are required peers.

## Usage

```tsx
import { PersonCard, PersonDialog, PersonList } from "@voyantjs/crm-ui"
import { VoyantProvider } from "@voyantjs/crm-react"

function App() {
  return (
    <VoyantProvider baseUrl="/api">
      <PersonList />
    </VoyantProvider>
  )
}
```

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

### Commercial Context Slots

`PersonDetailPage` and `OrganizationDetailPage` expose optional tab slots for
commercial context owned by other modules. This keeps `@voyantjs/crm-ui` free of
cross-package bookings, finance, and legal dependencies while giving consumers a
standard place to mount those relationships.

```tsx
<PersonDetailPage
  id={personId}
  slots={{
    bookingsTab: {
      count: bookings.length,
      content: <BookingsTable personId={personId} />,
    },
    invoicesTab: {
      count: invoices.length,
      content: <InvoicesTable personId={personId} />,
    },
    paymentsTab: {
      count: payments.length,
      content: <PaymentsTable personId={personId} />,
    },
    contractsTab: {
      count: contracts.length,
      content: <ContractsTable personId={personId} />,
    },
  }}
/>
```

## I18n

Components render English by default. To localize them, wrap your UI in
`CrmUiMessagesProvider` and import only the locales your app supports.

```tsx
import { CrmUiMessagesProvider } from "@voyantjs/crm-ui"
import { crmUiEn } from "@voyantjs/crm-ui/i18n/en"
import { crmUiRo } from "@voyantjs/crm-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

## Components

- `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`
- `PersonDetailPage`, `PersonTopBar`, `PersonSidebar`, `PersonMain`
- `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`
- `OrganizationDetailPage`, `OrganizationTopBar`, `OrganizationSidebar`, `OrganizationMain`
- `ActivitiesPage`, `CreateActivityDialog`, `CreateOpportunityDialog`
- `OpportunitiesBoard`, `OpportunitySummaryCard`
- `QuotesPage`, `CreateQuoteDialog`, `QuoteLinesCard`
