---
"@voyantjs/ui": minor
---

Add `DateTimePicker` primitive (`@/components/ui/date-time-picker`) and migrate every remaining `<Input type="datetime-local">` in the registry.

- Registered as `voyant-date-time-picker` in `packages/ui/registry.json` (`type: "registry:ui"`) so external consumers can install via `shadcn add voyant-date-time-picker`.
- Composes Calendar + an `HH:mm` time input inside a Popover, with the value serialized as `"YYYY-MM-DDTHH:mm"` — drop-in compatible with the native `<input type="datetime-local">` contract.
- Picking a new day preserves the existing time-of-day; clearing the time falls back to `00:00`.
- Supports the same `disabled` / `dateDisabled` / `clearable` props as the enhanced DatePicker.
- Migrated 6 sites across 4 registry files (booking guarantee, distribution sync + webhook dialogs, legal contract dialog), plus template copies in `templates/dmc`, `templates/operator`, `apps/dev`.
