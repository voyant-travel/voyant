# @voyantjs/crm-react

The CRM client tier: headless data hooks/clients plus the styled UI
components and page-level compositions (formerly `@voyantjs/crm-ui`).

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, `./admin`, `./i18n`, and `./styles.css`, whose
heavier peers (`@voyantjs/ui`, `@voyantjs/admin`, `@voyantjs/identity-react`)
are optional and only needed when you import those subpaths.

React runtime package for Voyant CRM. Provides the shared `VoyantProvider`, typed fetch client, query keys, and TanStack Query hooks that power CRM-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/crm-react @voyantjs/crm @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantProvider, usePeople } from "@voyantjs/crm-react"

function App() {
  return (
    <VoyantProvider baseUrl="/api">
      <PeopleList />
    </VoyantProvider>
  )
}

function PeopleList() {
  const { data } = usePeople()
  return <>{data?.items.map((person) => <div key={person.id}>{person.firstName}</div>)}</>
}
```

## UI components

Importable React UI components for Voyant CRM — person/organization cards, dialogs, lists, forms, and activity/quote dialogs. Bundler-consumed (Vite, Next.js, webpack, etc.).

### Install

```bash
pnpm add @voyantjs/crm-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives (Button, Card, Dialog, etc.). The root of this package provides the data-layer hooks. `@voyantjs/ui` is an optional peer required only when you import the styled subpaths.

### Usage

```tsx
import { PersonCard, PersonDialog, PersonList } from "@voyantjs/crm-react/ui"
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

#### Commercial Context Slots

`PersonDetailPage` and `OrganizationDetailPage` expose optional tab slots for
commercial context owned by other modules. This keeps the CRM UI tier free of
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

#### Detail Tab Replacement Slots

Detail pages also expose `*Content` slots for replacing built-in tab panels while
keeping the default tabs, counts, layout, and append-only `*End` slots. Use these
when an app needs inline CRUD controls without rendering a second panel below the
read-only default.

```tsx
<PersonDetailPage
  id={personId}
  slots={{
    activitiesContent: <EditableActivitiesPanel personId={personId} />,
  }}
/>
```

`PersonDetailPage` supports `overviewContent`, `quotesContent`,
`activitiesContent`, `relationshipsContent`, and `documentsContent`.
`OrganizationDetailPage` supports `overviewContent`, `peopleContent`,
`quotesContent`, and `activitiesContent`.

### I18n

Components render English by default. To localize them, wrap your UI in
`CrmUiMessagesProvider` and import only the locales your app supports.

```tsx
import { CrmUiMessagesProvider } from "@voyantjs/crm-react/ui"
import { crmUiEn } from "@voyantjs/crm-react/i18n/en"
import { crmUiRo } from "@voyantjs/crm-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

### Components

- `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`
- `PersonDetailPage`, `PersonTopBar`, `PersonSidebar`, `PersonMain`
- `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`
- `OrganizationDetailPage`, `OrganizationTopBar`, `OrganizationSidebar`, `OrganizationMain`
- `ActivitiesPage`, `CreateActivityDialog`, `CreateQuoteDialog`
- `QuotesBoard`, `QuoteSummaryCard`
- `QuoteVersionsPage`, `CreateQuoteVersionDialog`, `QuoteVersionLinesCard`

## License

Apache-2.0
