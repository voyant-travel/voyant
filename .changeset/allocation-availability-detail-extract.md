---
"@voyantjs/allocation-ui": patch
"@voyantjs/availability": patch
"@voyantjs/availability-ui": patch
---

Extract availability/allocation detail pages into shared packages.

- `AvailabilitySlotDetailPage`, the availability rule detail page, and the start-time detail page are now provided by `@voyantjs/availability-ui` so templates render the same surfaces instead of forking them. `templates/operator` deletes its local copies and the `_workspace/availability/*` routes mount the package components directly.
- `SlotAllocationPage` and `SlotAllocationResourceView` rebuilt: resource columns now scroll independently, the empty-state branch handles slots with no travelers, and the shared header drives selection/auto-assign actions from one place.
- `@voyantjs/availability` service-allocation tightens validation around resource-template links so the allocation manifest stays consistent when resource pools change mid-slot.
- New `OptionResourceTemplatesPanel` (in the operator template) consumed by the availability detail surface to expose resource-template wiring per option.
