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

## Components

- `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`
- `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`
- `ActivitiesPage`, `CreateActivityDialog`, `CreateOpportunityDialog`

## Not included (registry-only)

A subset of CRM components couples to TanStack Router or to template-local helpers and remains available only via the shadcn registry: `quotes-page`, `create-quote-dialog`, `quote-detail-sections`, `opportunities-board`, `opportunity-summary-card`, `organization-detail-page`, `organization-detail-sections`. These can be imported via `npx shadcn add @voyant/<component>` and customized per-project.
