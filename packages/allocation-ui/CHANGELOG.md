# @voyantjs/allocation-ui

## 0.62.3

### Patch Changes

- @voyantjs/availability-react@0.62.3
- @voyantjs/i18n@0.62.3
- @voyantjs/ui@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/availability-react@0.62.2
- @voyantjs/i18n@0.62.2
- @voyantjs/ui@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/availability-react@0.62.1
- @voyantjs/i18n@0.62.1
- @voyantjs/ui@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/availability-react@0.62.0
- @voyantjs/i18n@0.62.0
- @voyantjs/ui@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/availability-react@0.61.0
  - @voyantjs/i18n@0.61.0
  - @voyantjs/ui@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/availability-react@0.60.0
- @voyantjs/i18n@0.60.0
- @voyantjs/ui@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/availability-react@0.59.0
  - @voyantjs/i18n@0.59.0
  - @voyantjs/ui@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/availability-react@0.58.0
- @voyantjs/i18n@0.58.0
- @voyantjs/ui@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/availability-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/availability-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/availability-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/availability-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/availability-react@0.54.0
- @voyantjs/i18n@0.54.0
- @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/availability-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/availability-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/availability-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/availability-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/availability-react@0.52.3
- @voyantjs/i18n@0.52.3
- @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Extract availability/allocation detail pages into shared packages.

  - `AvailabilitySlotDetailPage`, the availability rule detail page, and the start-time detail page are now provided by `@voyantjs/availability-ui` so templates render the same surfaces instead of forking them. `templates/operator` deletes its local copies and the `_workspace/availability/*` routes mount the package components directly.
  - `SlotAllocationPage` and `SlotAllocationResourceView` rebuilt: resource columns now scroll independently, the empty-state branch handles slots with no travelers, and the shared header drives selection/auto-assign actions from one place.
  - `@voyantjs/availability` service-allocation tightens validation around resource-template links so the allocation manifest stays consistent when resource pools change mid-slot.
  - New `OptionResourceTemplatesPanel` (in the operator template) consumed by the availability detail surface to expose resource-template wiring per option.

- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/availability-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/availability-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/availability-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/availability-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Minor Changes

- 2316791: Add an inline edit affordance for allocation resources on `SlotAllocationPage`. Each resource row in the new per-sub-type table now has a pencil button that toggles a label + capacity form alongside the existing remove button. Capacity floors at `max(1, occupants.length)` so the form cannot shrink a bucket below the travelers already sitting in it. Wired to the already-exposed `resourceMutation.update.mutateAsync`, so the resource id stays stable across edits (no more delete-and-recreate churn that broke holds and audit refs).
- 2316791: Redesign `SlotAllocationPage` around an operator-class workflow.

  - **Capacity context.** Header surfaces "Slot pax: N/M" + "Resource capacity: X/M" with a coloured delta badge (fits / matches / over) so operators no longer have to navigate back to the slot detail to check the ceiling.
  - **Over-capacity guard.** The inline "Add resource" form shows a soft warning when the new resource would push total resource capacity above the slot's initial pax — soft, not blocking, so intentional oversells still go through.
  - **Card grid → table per sub-type.** `ResourceColumnsView` now renders one `<Table>` per sub-type group (DBL/SGL/TPL sections), one row per resource with Label · Capacity · Occupants (chip stack) · Edit / Remove. Replaces the alphabetic interleave that made scanning "all DBLs" require reading every other card.
  - **Drag-and-drop → click-to-allocate.** Each row has a "+ Assign" button that opens a `Popover` with a `Command`-driven picker of unallocated travelers — searchable, keyboard-friendly, accessible by default. Each occupant chip has an inline × to unassign. `VehicleSeatsView` cells switch to the same pattern.
  - **Embedded mode.** New `embed?: boolean` prop drops the page-level header so the body can be mounted inside a tab without a duplicate h1; capacity badges + actions cluster stay as an inline toolbar so the body is still self-sufficient.
  - **Empty-state.** The page renders even when both resources and travelers are empty so operators can seed the per-departure resource block before any bookings exist.
  - `DropColumn` renamed to `AllocationColumn` (now a passive layout primitive); `TravelerTile` strips its drag attrs.

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/availability-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/availability-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/availability-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/availability-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/availability-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/availability-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/availability-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/availability-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/availability-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/availability-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/availability-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/availability-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/availability-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/availability-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/availability-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/availability-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/availability-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/availability-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/availability-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/availability-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/availability-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/availability-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- 0809f47: Add SlotAllocationPage extension slots and extra tabs for consumer-owned financial summaries and pickup-point views.
  - @voyantjs/availability-react@0.40.1
  - @voyantjs/i18n@0.40.1
  - @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/availability-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/availability-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/availability-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/availability-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/availability-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/availability-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Minor Changes

- e0932ff: Ship a generic slot allocation surface with resource-kind tabs, vehicle seat maps, kind-aware automation actions, and allocation validation summaries.

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/availability-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/availability-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/availability-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/availability-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0
