---
"@voyantjs/allocation-ui": minor
---

Redesign `SlotAllocationPage` around an operator-class workflow.

- **Capacity context.** Header surfaces "Slot pax: N/M" + "Resource capacity: X/M" with a coloured delta badge (fits / matches / over) so operators no longer have to navigate back to the slot detail to check the ceiling.
- **Over-capacity guard.** The inline "Add resource" form shows a soft warning when the new resource would push total resource capacity above the slot's initial pax — soft, not blocking, so intentional oversells still go through.
- **Card grid → table per sub-type.** `ResourceColumnsView` now renders one `<Table>` per sub-type group (DBL/SGL/TPL sections), one row per resource with Label · Capacity · Occupants (chip stack) · Edit / Remove. Replaces the alphabetic interleave that made scanning "all DBLs" require reading every other card.
- **Drag-and-drop → click-to-allocate.** Each row has a "+ Assign" button that opens a `Popover` with a `Command`-driven picker of unallocated travelers — searchable, keyboard-friendly, accessible by default. Each occupant chip has an inline × to unassign. `VehicleSeatsView` cells switch to the same pattern.
- **Embedded mode.** New `embed?: boolean` prop drops the page-level header so the body can be mounted inside a tab without a duplicate h1; capacity badges + actions cluster stay as an inline toolbar so the body is still self-sufficient.
- **Empty-state.** The page renders even when both resources and travelers are empty so operators can seed the per-departure resource block before any bookings exist.
- `DropColumn` renamed to `AllocationColumn` (now a passive layout primitive); `TravelerTile` strips its drag attrs.
