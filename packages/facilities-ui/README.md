# @voyantjs/facilities-ui

React UI primitives for picking facilities by ID. Sibling to `@voyantjs/facilities-react`, follows the same shape as `@voyantjs/products-ui`'s entity comboboxes.

## Components

### `<FacilityCombobox />`

Backed by `useFacilities({ search, kind, limit })` from `@voyantjs/facilities-react`. Debounced search, returns the selected facility's TypeID via `value` / `onChange`.

```tsx
<FacilityCombobox
  value={cruise.embarkPortFacilityId}
  onChange={(id) => setCruise({ ...cruise, embarkPortFacilityId: id })}
  kind="port"
/>
```

Pass `kind` to scope the search — cruise UIs typically pass `"port"`, jet UIs `"airport"`, hotel UIs `"property"`, etc. Forwarded as the `kind` query param to `GET /v1/facilities/facilities`.

### `<FacilityBadge />`

Read-only display for places where you have a facility ID (or just its name) and want a styled chip instead of the raw `fac_*` TypeID.

```tsx
<FacilityBadge facilityId={cruise.embarkPortFacilityId} />
<FacilityBadge facilityId={cruise.embarkPortFacilityId} label={cruise.embarkPortName} />
```

When `label` is omitted, the component uses `useFacility(facilityId)` to resolve the name. Pass `label` directly when the parent record already carries a denormalized name to avoid an extra fetch.

## Setup

`@voyantjs/facilities-react` must be wired up in your app via `VoyantFacilitiesProvider` and a `QueryClientProvider`. Optionally wrap a sub-tree in `FacilitiesUiMessagesProvider` to override copy or run the UI in another locale.

```tsx
import { FacilitiesUiMessagesProvider } from "@voyantjs/facilities-ui"

<FacilitiesUiMessagesProvider locale={locale}>
  <FacilityCombobox ... />
</FacilitiesUiMessagesProvider>
```
