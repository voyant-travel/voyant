---
"@voyantjs/availability-ui": minor
---

Packaged-admin RFC availability pages delivered: the operator's availability
detail routes move into `@voyantjs/availability-ui/admin` as packaged hosts —
`AvailabilitySlotDetailHost` (the slot page with its Allocation tab from
`@voyantjs/allocation-ui`, the Extras manifest tab from
`@voyantjs/extras-ui`, the lazy booking create/quick-view sheets from
`@voyantjs/bookings-ui`, the product quick-view sheet from
`@voyantjs/products-ui`, and the slot edit dialog submitting through
`useAvailabilitySlotMutation`), `AvailabilityRuleDetailHost`,
`AvailabilityStartTimeDetailHost`, plus `OptionResourceTemplatesPanel` (the
per-option resource templates editor the product editor embeds). Data wiring
runs through the shared availability provider context instead of a host env
helper; cross-route links resolve through the semantic destination keys
(RFC §4.7) via `useAdminHref`/`useAdminNavigate` — new keys
`availabilitySlot.list` and `availabilityStartTime.detail`, with
`availabilitySlot.detail`, `booking.detail` and `product.detail` consumed
from the bookings-ui augmentation. `createAvailabilityAdminExtension`
contributes the availability route metadata (no nav — the Availability item
is base-nav-owned; no search contracts — the pages keep their filters
local). Host route files shrink to param binding; the availability INDEX
page stays an app-side wrapper because the bulk update/delete handlers call
the availability `batch-update`/`batch-delete` endpoints, which have no
`@voyantjs/availability-react` client equivalent yet. New availability-ui
peers: `@voyantjs/admin`, `@voyantjs/allocation-ui`, `@voyantjs/bookings-ui`,
`@voyantjs/extras-ui`, `@voyantjs/products-react`, `@voyantjs/products-ui`.
