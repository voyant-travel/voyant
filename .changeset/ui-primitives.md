---
"@voyantjs/ui": patch
---

UI primitives: `DatePicker` and `Select` polish.

- `DatePicker` / `DateRangePicker` default to `captionLayout="dropdown"` and ship a 100-year `startMonth`/`endMonth` window (`-90 → +10`). Without these, react-day-picker's year dropdown only listed the current year, so DOB pickers across the CRM/auth surfaces were unusable. Per-callsite overrides still work.
- `Select` simplified: drops the `collectSelectItems` child-walker now that `@base-ui/react/select` resolves labels from items directly. Trigger styling switches to `rounded-lg`, drops the redundant `shadow-xs`/`transition-[color,box-shadow]`, and aligns sm/default heights with the rest of the input set.
- Marked `Select` with `"use client"` so it works in RSC-first stacks (Next.js App Router examples).
