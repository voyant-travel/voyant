---
"@voyantjs/availability-ui": minor
"operator": patch
---

Promote the slimmed-down operator availability page into `@voyantjs/availability-ui`.

The reusable `AvailabilityPage` is now the slots + calendar layout from the recent operator refactor: header create button, product/status/date-range filters bar, ToggleGroup view switch, bulk status select, edit-slot dialog. Removed the legacy 6-tab overview shell (overview + rules/start-times/closeouts/pickup-points tabs) — nothing in the repo consumed it. Operator's local `availability-page.tsx` is now a thin shell that injects `api.post/patch` for bulk update/delete and slot mutate.

Prop changes:
- New: `defaultView`, `onSlotOpen`, optional `onSlotSubmit`, `slots.{headerEnd,beforeFilters,afterFilters,dialogs}`.
- Removed: `defaultTab`, rule/start-time/closeout/pickup-point handlers and helpers, `AvailabilityPageActiveFilter`, `AvailabilityPageTab`.
