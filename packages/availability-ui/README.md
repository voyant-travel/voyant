# @voyantjs/availability-ui

Reusable availability UI primitives for Voyant operator/admin apps.

The initial package surface is intentionally leaf-level so downstream apps can
replace copied availability UI incrementally while page-level composition stays
app-owned.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./components/*` | Availability UI components |
| `./utils` | Small formatting helpers |

## Surface

The package exports reusable pieces that keep app-owned data fetching,
routing, and mutations injected through props:

- `AvailabilityOverview`
- `AvailabilitySlotsTab`, `AvailabilityRulesTab`, `AvailabilityStartTimesTab`
- `AvailabilityCloseoutsTab`, `AvailabilityPickupPointsTab`
- `AvailabilityRuleDialog`, `AvailabilityStartTimeDialog`, `AvailabilitySlotDialog`
- `AvailabilityCloseoutDialog`, `AvailabilityPickupPointDialog`
- `AvailabilityPageSkeleton`, `AvailabilityBodySkeleton`, detail skeletons
- `availability*Columns` table column builders
- `AvailabilitySectionHeader`
- `formatLocalizedSelectionLabel`

## Usage

```tsx
import { AvailabilitySectionHeader } from "@voyantjs/availability-ui"

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
import { availabilitySlotColumns } from "@voyantjs/availability-ui"

<DataTable
  columns={availabilitySlotColumns(products, openSlotRoute, messages.availability)}
  data={slots}
/>
```

Dialogs expose the reusable form UI and validation while the app decides how
to persist the payload:

```tsx
import { AvailabilitySlotDialog } from "@voyantjs/availability-ui"

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
