# Allocation resources lifecycle

`allocation_resources` is the per-slot inventory primitive used by
tour/circuit products where an operator buys a fixed block from a
supplier per departure (a hotel allotment, a vehicle's seat map, a
guide roster, etc.). It sits next to the existing `availability_slots`
pax bucket — slot-level pax is the gross capacity, and resources break
that capacity into typed, individually-bookable units.

## Tables

- **`product_option_resource_templates`** (catalog) — the canonical
  resource mix per `product_option`. Stores `kind`, `capacity` per
  resource, a `name_pattern` for label rendering, and `default_count`
  (how many to instantiate per slot).
- **`allocation_resources`** (per-slot) — the materialised instances
  for one `availability_slot`. Cascades on slot delete.
- **`booking_traveler_travel_details.allocations`** (`jsonb`) — maps
  `kind → resource_id` for one traveler.

## Lifecycle

```
catalog                slot publish               admin / auto             read-side
─────────              ────────────               ─────────────            ──────────
template (DBL, cap 2, ──► generateAvailability   ─► allocation_resources ──► storefront
 default_count 20)       Slots() seeds resources    (20 DBL rooms with     resourceManifest
                         from template defaults    sortOrder labels)       (capacity / assigned
                                                                            / available)

                                                                          bookings.create
                                                                          TravelerWithTravel
                                                                          Details enforces
                                                                          per-resource cap.
```

### 1. Catalog: templates

Operators describe each option's room mix once at the catalog level
via `productOptionResourceTemplates`. Each row carries:

- `kind` — e.g. `"room_sgl"`, `"room_dbl"`, `"room_tpl"`,
  `"vehicle_seat"`.
- `capacity` — pax per instance.
- `name_pattern` — `"DBL {sequence}"` rendered when a resource is
  created.
- `default_count` — how many of this template to instantiate per
  slot at publish time. **`null` disables auto-materialisation** —
  the operator must seed resources manually or via the admin
  "auto-materialise" route once bookings exist.

### 2. Slot publish: auto-materialisation

`generateAvailabilitySlots()` calls
`materializeSlotResourcesFromTemplateDefaults()` for every newly-
created slot whose `optionId` has templates with a non-null
`default_count`. The helper is idempotent — kinds already seeded for
the slot are skipped, so re-running `generateAvailabilitySlots` after
an admin override won't blow away custom inventory.

Vehicle-seat layouts (`kind === "vehicle_seat"`) are intentionally
out of scope for the default-count path — they need pax-aware
hierarchy (vehicle parent + seat children). Use the admin
`autoMaterializeAllocationResources` route for those once the slot
has bookings.

### 3. Admin overrides

Operators can:

- Add/edit/delete `allocation_resources` for a slot directly.
- Re-seed a kind from templates via the admin route after deleting
  the current resources for that kind.
- Manually assign/unassign travelers to resources via
  `assignTravelerAllocation()` — the per-resource capacity check
  there matches the one used during booking creation.

### 4. Read-side: storefront

Storefront's departure response now includes a `resourceManifest`:

```jsonc
{
  "kinds":     [{ "kind": "room_dbl", "capacity": 40, "assigned": 6, "available": 34 }],
  "resources": [
    { "id": "alrs_…", "kind": "room_dbl", "label": "DBL 1",
      "capacity": 2, "assigned": 2, "available": 0, "flags": {…}, … }
  ]
}
```

`assigned` is a DISTINCT-traveler count across live bookings on the
slot — same logic the per-traveler assignment guard uses, so the
read-side and write-side agree.

### 5. Booking: per-resource enforcement

`bookings.createTravelerWithTravelDetails` /
`updateTravelerWithTravelDetails` validate any
`travelDetails.allocations` payload against per-resource capacity
before persisting. A request that fits inside the slot's
`remaining_pax` but oversells a specific resource is rejected with
`BookingServiceError.code === "resource_capacity_exhausted"` citing
the offending resource (`kind`, `resourceId`, `capacity`,
`existingAssigned`).

The slot-level pax check (`adjustSlotCapacity`) still runs at
reservation time — both gates must pass for a booking to confirm.
