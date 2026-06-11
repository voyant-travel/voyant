# @voyantjs/availability-react

The availability client tier: headless data hooks/clients plus the styled UI
primitives and page-level compositions (formerly `@voyantjs/availability-ui`).

Headless consumers (storefronts, portals) import from the root, `./hooks`,
`./client`, or `./query-keys` — these pull no styling peers. Styled surfaces
live under `./ui`, `./components/*`, `./admin`, `./i18n`, `./utils`, and
`./styles.css`, whose heavier peers (`@voyantjs/ui`, `@voyantjs/admin`,
`@tanstack/react-table`, `sonner`, `lucide-react`) are optional and only
needed when you import those subpaths.

## Install

```bash
pnpm add @voyantjs/availability-react @voyantjs/availability @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantAvailabilityProvider, useSlots } from "@voyantjs/availability-react"

function App() {
  return (
    <VoyantAvailabilityProvider baseUrl="/api">
      <SlotsList />
    </VoyantAvailabilityProvider>
  )
}

function SlotsList() {
  const { data } = useSlots()
  return <>{data?.data.map((slot) => <div key={slot.id}>{slot.dateLocal}</div>)}</>
}
```

## UI components

Reusable availability UI primitives and page compositions for Voyant
operator/admin apps.

### Exports

| Entry | Description |
| --- | --- |
| `./ui` | Barrel re-exports |
| `./i18n` | Availability UI message provider, defaults, and helpers |
| `./components/*` | Availability UI components |
| `./utils` | Small formatting helpers |

### Surface

The package exports reusable pieces that keep app-owned routing and the
availability batch mutations injected through props:

- `AvailabilityPage`
- `AvailabilityRuleDetailPage`, `AvailabilitySlotDetailPage`,
  `AvailabilityStartTimeDetailPage`
- `AvailabilityOverview`
- `AvailabilitySlotsTab`, `AvailabilityRulesTab`, `AvailabilityStartTimesTab`
- `AvailabilityCloseoutsTab`, `AvailabilityPickupPointsTab`
- `AvailabilityRuleDialog`, `AvailabilityStartTimeDialog`, `AvailabilitySlotDialog`
- `AvailabilityCloseoutDialog`, `AvailabilityPickupPointDialog`
- `AvailabilityPageSkeleton`, `AvailabilityBodySkeleton`, detail skeletons
- `availability*Columns` table column builders
- `AvailabilitySectionHeader`
- `AvailabilityUiMessagesProvider` and i18n helpers from `./i18n`
- `formatLocalizedSelectionLabel`

### Usage

`AvailabilityPage` owns the common operator availability shell, data hooks,
filters, overview metrics, table tabs, calendar tab, and rule/slot/start-time
dialogs. Route navigation and batch mutations stay app-specific:

```tsx
import { AvailabilityPage } from "@voyantjs/availability-react/ui"

<AvailabilityPage
  onSlotOpen={(id) => navigate({ to: "/availability/$id", params: { id } })}
  onRuleOpen={(id) => navigate({ to: "/availability/rules/$id", params: { id } })}
  onStartTimeOpen={(id) =>
    navigate({ to: "/availability/start-times/$id", params: { id } })
  }
  onProductOpen={(id) => navigate({ to: "/products/$id", params: { id } })}
  onBulkUpdate={handleAvailabilityBulkUpdate}
  onBulkDelete={handleAvailabilityBulkDelete}
/>
```

Closeout and pickup-point mutations are not owned by the headless tier yet.
Pass `onCloseoutSubmit` and `onPickupPointSubmit` to use the package dialogs, or
use the `slots.dialogs` escape hatch to render app-owned dialogs.

Detail pages expose query/loader helpers that accept the app's API client:

```tsx
import { defaultFetcher } from "@voyantjs/availability-react"
import {
  AvailabilitySlotDetailPage,
  loadAvailabilitySlotDetailPage,
} from "@voyantjs/availability-react/ui"

const client = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/availability/$id")({
  loader: ({ context, params }) =>
    loadAvailabilitySlotDetailPage(context.queryClient, client, params.id),
  component: () => {
    const { id } = Route.useParams()
    return (
      <AvailabilitySlotDetailPage
        id={id}
        onBack={() => navigate({ to: "/availability" })}
        onOpenProduct={(productId) =>
          navigate({ to: "/products/$id", params: { id: productId } })
        }
        onOpenStartTime={(startTimeId) =>
          navigate({ to: "/availability/start-times/$id", params: { id: startTimeId } })
        }
      />
    )
  },
})
```

Wrap consumers in `AvailabilityUiMessagesProvider` for package-level copy and
locale-aware formatting. Without a provider the package falls back to English.

```tsx
import { AvailabilityUiMessagesProvider } from "@voyantjs/availability-react/i18n"

<AvailabilityUiMessagesProvider locale={resolvedLocale}>
  <AvailabilityPage onBulkUpdate={handleBulkUpdate} onBulkDelete={handleBulkDelete} />
</AvailabilityUiMessagesProvider>
```

Leaf components remain available for custom page shells:

```tsx
import { AvailabilitySectionHeader } from "@voyantjs/availability-react/ui"

function SlotsHeader() {
  return (
    <AvailabilitySectionHeader
      title="Slots"
      description="Manage generated capacity."
      actionLabel="Create slot"
      onAction={() => setOpen(true)}
    />
  )
}
```

Table column builders are available for apps that use `@voyantjs/ui`'s
`DataTable` and keep routing behavior app-owned:

```tsx
import { availabilitySlotColumns } from "@voyantjs/availability-react/ui"

<DataTable
  columns={availabilitySlotColumns(products, openSlotRoute, messages.availability)}
  data={slots}
/>
```

Dialogs expose the reusable form UI and validation while the app decides how
to persist the payload:

```tsx
import { AvailabilitySlotDialog } from "@voyantjs/availability-react/ui"

<AvailabilitySlotDialog
  messages={messages.availability}
  open={open}
  onOpenChange={setOpen}
  products={products}
  rules={rules}
  startTimes={startTimes}
  onSubmit={(payload, context) =>
    context.isEditing
      ? api.patch(`/v1/availability/slots/${context.id}`, payload)
      : api.post("/v1/availability/slots", payload)
  }
  onSuccess={refresh}
/>
```

## License

Apache-2.0
