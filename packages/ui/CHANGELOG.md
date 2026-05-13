# @voyantjs/ui

## 0.41.0

### Patch Changes

- @voyantjs/i18n@0.41.0
- @voyantjs/notifications@0.41.0
- @voyantjs/notifications-react@0.41.0
- @voyantjs/utils@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/i18n@0.40.1
- @voyantjs/notifications@0.40.1
- @voyantjs/notifications-react@0.40.1
- @voyantjs/utils@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/i18n@0.40.0
- @voyantjs/notifications@0.40.0
- @voyantjs/notifications-react@0.40.0
- @voyantjs/utils@0.40.0

## 0.39.0

### Minor Changes

- f4235ea: Finish the bookings passenger-to-traveler rename across the React/UI layer and shadcn registry.

  `@voyantjs/bookings-ui` now exposes `TravelersSection` and traveler-first section value/types. `@voyantjs/bookings-react` uses traveler hooks/query helpers over the traveler endpoints. The bookings activity enum now emits `traveler_update`; dev/operator/DMC migrations rename existing `passenger_update` activity rows.

  The shadcn registry now publishes `voyant-bookings-travelers-section` and removes the stale passenger dialog/list/section registry artifacts.

### Patch Changes

- @voyantjs/i18n@0.39.0
- @voyantjs/notifications@0.39.0
- @voyantjs/notifications-react@0.39.0
- @voyantjs/utils@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/i18n@0.38.2
- @voyantjs/notifications@0.38.2
- @voyantjs/notifications-react@0.38.2
- @voyantjs/utils@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/i18n@0.38.1
- @voyantjs/notifications@0.38.1
- @voyantjs/notifications-react@0.38.1
- @voyantjs/utils@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/i18n@0.38.0
- @voyantjs/notifications@0.38.0
- @voyantjs/notifications-react@0.38.0
- @voyantjs/utils@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/i18n@0.37.1
- @voyantjs/notifications@0.37.1
- @voyantjs/notifications-react@0.37.1
- @voyantjs/utils@0.37.1

## 0.37.0

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
  - @voyantjs/i18n@0.37.0
  - @voyantjs/notifications@0.37.0
  - @voyantjs/notifications-react@0.37.0
  - @voyantjs/utils@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/i18n@0.36.0
- @voyantjs/notifications@0.36.0
- @voyantjs/notifications-react@0.36.0
- @voyantjs/utils@0.36.0

## 0.35.0

### Patch Changes

- baa6134: Replace the tabbed product detail page with the sectioned operator layout and upgrade product media management from a table to a gallery with preview, cover selection, and reorder controls.
  - @voyantjs/i18n@0.35.0
  - @voyantjs/notifications@0.35.0
  - @voyantjs/notifications-react@0.35.0
  - @voyantjs/utils@0.35.0

## 0.34.0

### Patch Changes

- 70ee277: Add a shared CurrencyInput and use it for editable operator money fields so forms display decimal amounts with the currency symbol and code while still submitting minor units.
- f2d4802: Replace native date and datetime inputs with shared DatePicker and DateTimePicker controls.
- Updated dependencies [6ad175a]
- Updated dependencies [a37d4af]
  - @voyantjs/i18n@0.34.0
  - @voyantjs/notifications@0.34.0
  - @voyantjs/notifications-react@0.34.0
  - @voyantjs/utils@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/i18n@0.33.1
- @voyantjs/notifications@0.33.1
- @voyantjs/notifications-react@0.33.1
- @voyantjs/utils@0.33.1

## 0.33.0

### Minor Changes

- db46afc: Breaking change: `@voyantjs/ui` now declares `recharts` as a peer dependency instead of installing its own runtime copy, so chart wrappers share the consuming app's Recharts instance and avoid duplicate chart context.

  Consumers that use `@voyantjs/ui/components` or any chart primitives must install `recharts` directly, for example `pnpm add recharts@^3.0.0`. If chart cards render headers with blank bodies, run `pnpm -r why recharts` and confirm the app resolves a single Recharts version.

### Patch Changes

- @voyantjs/i18n@0.33.0
- @voyantjs/notifications@0.33.0
- @voyantjs/notifications-react@0.33.0
- @voyantjs/utils@0.33.0

## 0.32.3

### Patch Changes

- 7632a66: Export all first-class component modules from the `@voyantjs/ui/components` barrel and add a verifier to prevent future drift.
  - @voyantjs/i18n@0.32.3
  - @voyantjs/notifications@0.32.3
  - @voyantjs/notifications-react@0.32.3
  - @voyantjs/utils@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/i18n@0.32.2
- @voyantjs/notifications@0.32.2
- @voyantjs/notifications-react@0.32.2
- @voyantjs/utils@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/i18n@0.32.1
- @voyantjs/notifications@0.32.1
- @voyantjs/notifications-react@0.32.1
- @voyantjs/utils@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/i18n@0.32.0
- @voyantjs/notifications@0.32.0
- @voyantjs/notifications-react@0.32.0
- @voyantjs/utils@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/i18n@0.31.4
- @voyantjs/notifications@0.31.4
- @voyantjs/notifications-react@0.31.4
- @voyantjs/utils@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/i18n@0.31.3
- @voyantjs/notifications@0.31.3
- @voyantjs/notifications-react@0.31.3
- @voyantjs/utils@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/i18n@0.31.2
  - @voyantjs/notifications@0.31.2
  - @voyantjs/notifications-react@0.31.2
  - @voyantjs/utils@0.31.2

## 0.31.1

### Patch Changes

- 00f7c4f: Render product itinerary day descriptions with the shared rich text editor so imported HTML content can be edited without exposing raw markup.

  Add link support to the shared rich text editor, including safe URL handling and toolbar actions for adding or removing links.

  - @voyantjs/i18n@0.31.1
  - @voyantjs/notifications@0.31.1
  - @voyantjs/notifications-react@0.31.1
  - @voyantjs/utils@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/i18n@0.31.0
- @voyantjs/notifications@0.31.0
- @voyantjs/notifications-react@0.31.0
- @voyantjs/utils@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/i18n@0.30.7
- @voyantjs/notifications@0.30.7
- @voyantjs/notifications-react@0.30.7
- @voyantjs/utils@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/i18n@0.30.6
- @voyantjs/notifications@0.30.6
- @voyantjs/notifications-react@0.30.6
- @voyantjs/utils@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/i18n@0.30.5
- @voyantjs/notifications@0.30.5
- @voyantjs/notifications-react@0.30.5
- @voyantjs/utils@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/i18n@0.30.4
- @voyantjs/notifications@0.30.4
- @voyantjs/notifications-react@0.30.4
- @voyantjs/utils@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/i18n@0.30.3
- @voyantjs/notifications@0.30.3
- @voyantjs/notifications-react@0.30.3
- @voyantjs/utils@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/i18n@0.30.2
- @voyantjs/notifications@0.30.2
- @voyantjs/notifications-react@0.30.2
- @voyantjs/utils@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/i18n@0.30.1
- @voyantjs/notifications@0.30.1
- @voyantjs/notifications-react@0.30.1
- @voyantjs/utils@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/i18n@0.30.0
- @voyantjs/notifications@0.30.0
- @voyantjs/notifications-react@0.30.0
- @voyantjs/utils@0.30.0

## 0.29.0

### Minor Changes

- 4a6523e: Reminder sequences UI cleanup (#488):

  - `NotificationSettingsForm` drops the holiday-calendar combobox section. The
    DB column stays in place (nullable) for forward-compat, but the UI no longer
    exposes it — proper holiday handling needs a real public-holidays source and
    is out of scope.
  - `NotificationReminderRulesPage` gains a per-row **Manage stages** link that
    points at `/notifications/reminder-rules/<id>` and accepts a
    `manageStagesHref` prop so consumers can override the URL pattern. The
    legacy "Timing" column is removed because timing is owned by stages now.
  - `NotificationReminderRuleDialog` drops the `Send timing` field and the
    payload always writes `relativeDaysFromDueDate: 0`. New rules are expected
    to define their timing via stages; the dialog's purpose is now creating the
    rule shell + picking a default template + assigning a channel. A help line
    on the create form points the user at "Manage stages" as the next step.
  - Adds a perf migration (`0002_reminder_dispatcher_perf`) with partial / composite
    indexes targeting the new dispatcher's hot queries: open invoices by
    `due_date`, open payment schedules by `due_date`, reminder runs by
    `(rule, target, scheduled_for)`, and reminder runs by
    `(recipient, status, processed_at)` for suppression / rate-limit lookups.

### Patch Changes

- 4a6523e: Reminder rule dialog: make the default template optional (#488).

  Stage channels carry their own templates and override the rule-level default,
  so the legacy rule-creation dialog no longer needs to require a template at
  form-submit time. Without this, clicking **Create Rule** with no template
  selected silently failed Zod validation and the dialog appeared frozen.

  Backend `insertNotificationReminderRuleSchema` and
  `updateNotificationReminderRuleSchema` drop the `templateId || templateSlug`
  refinement to match.

  Also narrows the dispatcher's per-target booking lookup from a full-row
  `select()` to the columns actually used by recipient resolution. This avoids
  projecting every column declared in the bookings schema and tolerates
  deployments / test stubs that lag the latest column set.

- 4a6523e: Drop legacy single-offset reminder path; polish channel editor (#488).

  Stage channel editor:

  - Replaces the two free-text "Template id / Template slug" fields with
    a single async `<TemplatePicker>` (typeahead via `AsyncCombobox`)
    filtered by the channel selected at the top of the dialog. Picking
    a template now resolves to the template id directly — no more
    guessing slugs. Switching channel clears the picked template since
    the next list will be filtered.
  - Provider becomes a `<Select>` with **Automatic** / **Resend
    (email)** / **Twilio (SMS)** options. "Automatic" maps to `null`
    (use the deployment default for that channel).
  - Drops the freeform "Recipient role" field. Recipient resolution is
    driven by the booking's primary contact / first traveler today;
    the role tag wasn't actually consulted by the dispatcher.

  Backend cleanup (we're in beta — no users, no compat needed):

  - Drops the `relative_days_from_due_date` column from
    `notification_reminder_rules` (migration
    `0003_drop_legacy_columns.sql`).
  - Drops the `holiday_calendar` column from `notification_settings`
    (UI was already gone; the underlying public-holidays integration is
    out of scope for this iteration).
  - Removes the legacy single-offset dispatcher path entirely:
    `queueDueReminders` and `runDueReminders` now delegate straight to
    the stage-aware versions, and the four legacy helpers
    (`queueBookingPaymentScheduleReminder`,
    `queueInvoiceReminder`, `sendBookingPaymentScheduleReminder`,
    `sendInvoiceReminder`) plus the `ruleHasStages` skip check are
    deleted. Net ~500 lines removed from `service-reminders.ts`.
  - `relativeDaysFromDueDate` removed from validation, the run-summary
    schema, the notifications-react record schema, the operator
    template detail page, the legacy rule dialog, and the checkout
    service's reminder-runs join projection.
  - Legacy integration tests `reminders.test.ts` and
    `reminder-tasks.test.ts` are deleted; the stage-based
    `reminder-sequences.test.ts` covers the path that survives.

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/i18n@0.29.0
  - @voyantjs/notifications@0.29.0
  - @voyantjs/notifications-react@0.29.0
  - @voyantjs/utils@0.29.0

## 0.28.3

### Patch Changes

- 60ef432: Add a `big-calendar` primitive — full-screen month / week / day calendar view with header, navigation, and event interaction primitives — exposed at the new `@voyantjs/ui/components/big-calendar` subpath export.

  Also adds a `bg-calendar-disabled-hour` Tailwind utility (uses `color-mix(in oklab, var(--muted) 35%, transparent)`) for shading out-of-business hours in the week / day views, so consumers don't need to hand-roll the rgba.

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/i18n@0.28.3
  - @voyantjs/notifications@0.28.3
  - @voyantjs/notifications-react@0.28.3
  - @voyantjs/utils@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/i18n@0.28.2
- @voyantjs/notifications@0.28.2
- @voyantjs/notifications-react@0.28.2
- @voyantjs/utils@0.28.2

## 0.28.1

### Patch Changes

- 9d88eae: Fix #479: `priceCatalogRecordSchema.currencyCode` is now `z.string().nullable()`, matching the DB column, the server-side core schema, and the `#462` "NULL means follow `product.sellCurrency`" semantics. Operators using a single default public catalog with `currency_code = NULL` no longer hit `Voyant API response failed validation` on the catalog-settings page or the departure-pricing-override dialog.

  `PriceCatalogRecord["currencyCode"]` is now `string | null`. Registry components in `@voyantjs/ui` (`price-catalogs-page`, `price-catalog-dialog`) render the NULL case as `—` and load it as `""` into the form. Direct consumers of `record.currencyCode` should add a similar fallback.

  - @voyantjs/i18n@0.28.1
  - @voyantjs/notifications@0.28.1
  - @voyantjs/notifications-react@0.28.1
  - @voyantjs/utils@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/i18n@0.28.0
- @voyantjs/notifications@0.28.0
- @voyantjs/notifications-react@0.28.0
- @voyantjs/utils@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/i18n@0.27.0
  - @voyantjs/notifications@0.27.0
  - @voyantjs/notifications-react@0.27.0
  - @voyantjs/utils@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/i18n@0.26.9
  - @voyantjs/notifications@0.26.9
  - @voyantjs/notifications-react@0.26.9
  - @voyantjs/utils@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/i18n@0.26.8
- @voyantjs/notifications@0.26.8
- @voyantjs/notifications-react@0.26.8
- @voyantjs/utils@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/i18n@0.26.7
- @voyantjs/notifications@0.26.7
- @voyantjs/notifications-react@0.26.7
- @voyantjs/utils@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/i18n@0.26.6
- @voyantjs/notifications@0.26.6
- @voyantjs/notifications-react@0.26.6
- @voyantjs/utils@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/i18n@0.26.5
- @voyantjs/notifications@0.26.5
- @voyantjs/notifications-react@0.26.5
- @voyantjs/utils@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/i18n@0.26.4
- @voyantjs/notifications@0.26.4
- @voyantjs/notifications-react@0.26.4
- @voyantjs/utils@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/i18n@0.26.3
- @voyantjs/notifications@0.26.3
- @voyantjs/notifications-react@0.26.3
- @voyantjs/utils@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/i18n@0.26.2
- @voyantjs/notifications@0.26.2
- @voyantjs/notifications-react@0.26.2
- @voyantjs/utils@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/i18n@0.26.1
- @voyantjs/notifications@0.26.1
- @voyantjs/notifications-react@0.26.1
- @voyantjs/utils@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/i18n@0.26.0
- @voyantjs/notifications@0.26.0
- @voyantjs/notifications-react@0.26.0
- @voyantjs/utils@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/i18n@0.25.0
- @voyantjs/notifications@0.25.0
- @voyantjs/notifications-react@0.25.0
- @voyantjs/utils@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/i18n@0.24.3
- @voyantjs/notifications@0.24.3
- @voyantjs/notifications-react@0.24.3
- @voyantjs/utils@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/i18n@0.24.2
- @voyantjs/notifications@0.24.2
- @voyantjs/notifications-react@0.24.2
- @voyantjs/utils@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
  - @voyantjs/i18n@0.24.1
  - @voyantjs/notifications@0.24.1
  - @voyantjs/notifications-react@0.24.1
  - @voyantjs/utils@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/i18n@0.24.0
- @voyantjs/notifications@0.24.0
- @voyantjs/notifications-react@0.24.0
- @voyantjs/utils@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/i18n@0.23.0
- @voyantjs/notifications@0.23.0
- @voyantjs/notifications-react@0.23.0
- @voyantjs/utils@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/i18n@0.22.0
- @voyantjs/notifications@0.22.0
- @voyantjs/notifications-react@0.22.0
- @voyantjs/utils@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/i18n@0.21.1
- @voyantjs/notifications@0.21.1
- @voyantjs/notifications-react@0.21.1
- @voyantjs/utils@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/i18n@0.21.0
  - @voyantjs/notifications@0.21.0
  - @voyantjs/notifications-react@0.21.0
  - @voyantjs/utils@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/i18n@0.20.0
- @voyantjs/notifications@0.20.0
- @voyantjs/notifications-react@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/i18n@0.19.0
- @voyantjs/notifications@0.19.0
- @voyantjs/notifications-react@0.19.0
- @voyantjs/utils@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/i18n@0.18.0
- @voyantjs/notifications@0.18.0
- @voyantjs/notifications-react@0.18.0
- @voyantjs/utils@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Charters pricing was built around four hardcoded "first-class" currencies (USD/EUR/GBP/AUD). Adding a new currency required schema, validation, service, adapter, React, and UI changes — a domain constraint, not an i18n concern. This release replaces the column-per-currency shape with `pricesByCurrency: Record<currency, amount>` jsonb maps so adding a new currency is a content change, not a migration.

  **Schema:**

  - `charter_suites.{price,port_fee}_{usd,eur,gbp,aud}` (8 cols) → `prices_by_currency` + `port_fees_by_currency` (2 jsonb cols).
  - `charter_voyages.whole_yacht_price_{usd,eur,gbp,aud}` (4 cols) → `whole_yacht_prices_by_currency` (1 jsonb col).
  - `charter_products.lowest_price_cached_usd` → `lowest_price_cached_amount` + `lowest_price_cached_currency` (deployment-chosen browse currency).

  **API surface:** Removed `FIRST_CLASS_CURRENCIES`, `firstClassCurrencySchema`, `FirstClassCurrency`. Hook request types `currency: "USD"|"EUR"|"GBP"|"AUD"` → `currency: string`. `ExternalCharterProductSummary.lowestPriceUSD` → `lowestPriceAmount` + `lowestPriceCurrency`. `pricingService.lowestSuitePriceUSD` → `lowestSuitePriceForCurrency(db, voyageId, currency)`. `recomputeProductAggregates(db, productId, { browseCurrency? })` accepts an explicit browse currency; defaults to `"USD"` for backward compatibility.

  **Migration:** Existing deployments need a one-shot SQL backfill of the new jsonb columns from the old per-currency columns before the column drop lands. See PR #355 description for a sketch.

- 66d722d: Complete the UI i18n rollout: every `*-ui` package now ships locale-aware messages with English + Romanian definitions, a `MessagesProvider`, and a parity test harness. New packages adding UI components should mirror the same shape (see `packages/suppliers-ui` as the reference).

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/i18n@0.17.0
  - @voyantjs/notifications@0.17.0
  - @voyantjs/notifications-react@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/notifications@0.16.0
- @voyantjs/notifications-react@0.16.0
- @voyantjs/utils@0.16.0

## 0.15.0

### Minor Changes

- 361c8c5: Add `DateTimePicker` primitive (`@/components/ui/date-time-picker`) and migrate every remaining `<Input type="datetime-local">` in the registry.

  - Registered as `voyant-date-time-picker` in `packages/ui/registry.json` (`type: "registry:ui"`) so external consumers can install via `shadcn add voyant-date-time-picker`.
  - Composes Calendar + an `HH:mm` time input inside a Popover, with the value serialized as `"YYYY-MM-DDTHH:mm"` — drop-in compatible with the native `<input type="datetime-local">` contract.
  - Picking a new day preserves the existing time-of-day; clearing the time falls back to `00:00`.
  - Supports the same `disabled` / `dateDisabled` / `clearable` props as the enhanced DatePicker.
  - Migrated 6 sites across 4 registry files (booking guarantee, distribution sync + webhook dialogs, legal contract dialog), plus template copies in `templates/dmc`, `templates/operator`, `apps/dev`.

- 24869f4: UI consistency sweep across every registry dialog and form:

  - **New primitive**: `CurrencyCombobox` (`@/components/ui/currency-combobox`) — searchable currency picker backed by the canonical `currencies` list from `@voyantjs/utils`. Trigger renders `CODE (symbol)`; items render `CODE — Name (symbol)`. Registered in `packages/ui/registry.json` as `voyant-currency-combobox` with `type: "registry:ui"` so external consumers can install via `shadcn add voyant-currency-combobox`.
  - **DatePicker enhancement**: added first-class `disabled?: boolean` (disables the entire picker) and `dateDisabled` (day-level matcher, forwards to underlying Calendar) props. Replaces prior ambiguity where `disabled` collided with react-day-picker's Matcher type.
  - **Swept every registry dialog + form**:
    - Native `<Input type="date">` → `<DatePicker>` (56 sites across bookings, finance, transactions, hospitality, legal, distribution, products).
    - Currency `<Input maxLength={3}>` → `<CurrencyCombobox>` (18 sites across the same domains).
    - Bare `<SelectTrigger>` → `<SelectTrigger className="w-full">` so the trigger fills its form column (~118 sites across every domain).
  - Template copies in `templates/dmc`, `templates/operator`, and `apps/dev` synced with the registry source.

- cccc905: `@voyantjs/ui` is now publishable. Consumers can `pnpm add @voyantjs/ui` and import primitives directly instead of copying them via the shadcn registry — updates flow with version bumps. The registry path remains for components you intend to fork.

  **What changed:**

  - `private: true` flipped to publishable; package removed from changesets `ignore` and added to the linked release group.
  - New `tsconfig.build.json` emits `dist/` (JS + `.d.ts` + declaration maps) under `module: ESNext` / `moduleResolution: Bundler`. The package is bundler-consumed by design.
  - New `build`, `clean`, `prepack`, `typecheck` scripts. `prepack` runs the build so `pnpm pack` produces a complete tarball.
  - `publishConfig.exports` mirrors the dev `exports` map but points at `./dist/*.js` + `./dist/*.d.ts`. Workspace consumers continue to resolve `./src/*` directly; only published consumers see the dist paths.
  - `files: ["dist", "src/styles", "postcss.config.mjs"]` — `globals.css` ships as-is for consumers to import.
  - Editor `tsconfig.json` aligned to `Bundler` resolution to match the build (avoids extensionless-import false positives in `tsc --noEmit`).
  - One latent type bug in `input-group.tsx` fixed (`querySelector` lacked an explicit element-type narrowing).

  **Tree-shaking:** `sideEffects: false` is set across all UI/react packages in this repo, so unused named exports drop through barrels in modern bundlers.

### Patch Changes

- cccc905: Bulk-extract per-domain importable UI packages, mirroring the `*-react` split. 17 new `*-ui` packages shipping a combined 137 components; primitives package `voyant-ui` gains 3 promoted shared primitives (`currency-combobox`, `date-time-picker`, `country-combobox`).

  **New `*-ui` packages**: `booking-requirements`, `bookings`, `charters`, `cruises`, `distribution`, `external-refs`, `extras`, `finance`, `hospitality`, `identity`, `legal`, `markets`, `pricing`, `products`, `resources`, `sellability`, `suppliers`. (Already shipped in prior commit: `crm-ui`.)

  **`voyant-ui` additions**: `CurrencyCombobox`, `DateTimePicker`, `CountryCombobox` — promoted from registry/template-local sources because they're shared primitives that 21 domain components depend on. Adds `@voyantjs/utils` to dependencies.

  **Two distribution modes for every domain**:

  - Importable: `pnpm add @voyantjs/<domain>-ui` — version-tracked, updates flow with bumps
  - Registry: `npx shadcn add @voyant/<component>` — copy + own, fork-friendly

  **Components NOT in importable packages** (registry-only):

  - Router-coupled components (TanStack Router): legal `quotes-page`, `create-quote-dialog`, etc.
  - Template-local-helper-coupled: `@/components/voyant/crm/*` deps, `@/lib/api-client` deps
  - Components with pre-existing latent bugs surfaced by per-package compilation: API drift against `*-react` hooks (e.g., `useBookingItemParticipants` no longer exists), loose typing that worked under permissive consumer tsconfigs but not under strict library compilation, broken imports to skipped sibling components

  The full coupling-and-bug list is preserved in each package's README. These components remain consumable via the shadcn registry path; they can be promoted into the importable packages when their underlying issues are fixed.

  **Domains with no importable surface** (all components either failed to compile or were registry-only by design): `auth`, `ground`, `notifications`, `transactions`. Their components remain available via the registry.

  **Tree-shaking**: `sideEffects: false` is set across all packages. With ESM + Bundler-resolution, modern bundlers (Vite, webpack, Next.js) drop unused named exports through barrels.

- e84fe0f: Add shared upload-aware media workflows to the product registry components.

  `product-media-section` now supports optional file upload handlers and compact
  embedded rendering for day-level media management. `product-itinerary-section`
  now renders the shared day-media section directly inside expanded itinerary day
  rows, so apps no longer need a local wrapper just to manage day media uploads.

  - @voyantjs/notifications@0.15.0
  - @voyantjs/notifications-react@0.15.0
  - @voyantjs/utils@0.15.0
