---
"@voyantjs/ui": minor
---

UI consistency sweep across every registry dialog and form:

- **New primitive**: `CurrencyCombobox` (`@/components/ui/currency-combobox`) — searchable currency picker backed by the canonical `currencies` list from `@voyantjs/utils`. Trigger renders `CODE (symbol)`; items render `CODE — Name (symbol)`. Registered in `packages/ui/registry.json` as `voyant-currency-combobox` with `type: "registry:ui"` so external consumers can install via `shadcn add voyant-currency-combobox`.
- **DatePicker enhancement**: added first-class `disabled?: boolean` (disables the entire picker) and `dateDisabled` (day-level matcher, forwards to underlying Calendar) props. Replaces prior ambiguity where `disabled` collided with react-day-picker's Matcher type.
- **Swept every registry dialog + form**:
  - Native `<Input type="date">` → `<DatePicker>` (56 sites across bookings, finance, transactions, hospitality, legal, distribution, products).
  - Currency `<Input maxLength={3}>` → `<CurrencyCombobox>` (18 sites across the same domains).
  - Bare `<SelectTrigger>` → `<SelectTrigger className="w-full">` so the trigger fills its form column (~118 sites across every domain).
- Template copies in `templates/dmc`, `templates/operator`, and `apps/dev` synced with the registry source.
