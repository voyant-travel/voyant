# @voyantjs/facilities-react

Compatibility React package for shared places. New code should prefer
`@voyantjs/places-react`, which re-exports this implementation with place-first
names.

Headless consumers import from the root, `./hooks`, or `./client` — these pull
no styling peers. Styled surfaces live under `./ui`, `./components/*`,
`./i18n`, and `./styles.css`, whose heavier peers (`@voyantjs/ui`) are
optional and only needed when you import those subpaths.

## Components

### `<PlaceCombobox />` / `<FacilityCombobox />`

Backed by `useFacilities({ search, kind, limit })` from the headless tier.
Debounced search, returns the selected place's compatibility TypeID via `value`
and `onChange`.

```tsx
<PlaceCombobox
  value={cruise.embarkPortFacilityId}
  onChange={(id) => setCruise({ ...cruise, embarkPortFacilityId: id })}
  kind="port"
/>
```

Pass `kind` to scope the search. Cruise UIs typically pass `"port"`, air
transfer UIs `"airport"`, and accommodation resale UIs `"hotel"` or `"property"`
only as a location/content hint. Forwarded as the `kind` query param to
`GET /v1/facilities/facilities` until the route move lands.

### `<PlaceBadge />` / `<FacilityBadge />`

Read-only display for places where you have a compatibility `facilityId` (or
just its name) and want a styled chip instead of the raw `fac_*` TypeID.

```tsx
<PlaceBadge facilityId={cruise.embarkPortFacilityId} />
<PlaceBadge facilityId={cruise.embarkPortFacilityId} label={cruise.embarkPortName} />
```

When `label` is omitted, the component uses `useFacility(facilityId)` to resolve the name. Pass `label` directly when the parent record already carries a denormalized name to avoid an extra fetch.

## Setup

`@voyantjs/facilities-react` must be wired up in your app via
`VoyantFacilitiesProvider` and a `QueryClientProvider`. With the new package
name, use `VoyantPlacesProvider` and `PlacesUiMessagesProvider`.

```tsx
import { PlacesUiMessagesProvider } from "@voyantjs/places-react/ui"

<PlacesUiMessagesProvider locale={locale}>
  <PlaceCombobox ... />
</PlacesUiMessagesProvider>
```
