# @voyantjs/notifications-react

## 0.41.3

### Patch Changes

- @voyantjs/notifications@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/notifications@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/notifications@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/notifications@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/notifications@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/notifications@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/notifications@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/notifications@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/notifications@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/notifications@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/notifications@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/notifications@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/notifications@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/notifications@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/notifications@0.34.0
- @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/notifications@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/notifications@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/notifications@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/notifications@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/notifications@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/notifications@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/notifications@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/notifications@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/notifications@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/notifications@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/notifications@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/notifications@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/notifications@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/notifications@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/notifications@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/notifications@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/notifications@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/notifications@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/notifications@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Minor Changes

- 4a6523e: Reminder sequences UI (#488).

  New `@voyantjs/notifications-ui` package with the reminder-sequence editing surface:

  - `<StageList />` — ordered stages per rule, with reorder + delete and an embedded channel list.
  - `<StageEditorDialog />` — anchor / window / cadence (`once` | `every_n_days` | `escalating(buckets[])`) / `maxSendsInStage` / `respectQuietHours`.
  - `<StageChannelList />` + `<StageChannelEditorDialog />` — per-stage multi-channel rows (channel, template, recipient kind, optional role).
  - `<NotificationSettingsForm />` — quiet hours / blackout dates / weekend skip / recipient daily cap / suppression window.
  - `<RemindersPreviewList />` — read-only "what would fire on this date" table with reasoning per row.
  - Full en/ro i18n with `NotificationsUiMessagesProvider`.

  Hooks added to `@voyantjs/notifications-react`:

  - `useReminderRuleStages`, `useReminderRuleStageMutation` (create, update, delete, reorder)
  - `useReminderStageChannels`, `useReminderStageChannelMutation`
  - `useNotificationSettings`, `useNotificationSettingsMutation`
  - `useRemindersPreview`

  Operator template wires up three new routes (`/notifications/reminder-rules/:id`, `/notifications/preview`, `/notifications/settings`) and the operator nav gains Preview + Settings entries.

### Patch Changes

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
  - @voyantjs/notifications@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/notifications@0.28.3
- @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/notifications@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/notifications@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/notifications@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/notifications@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/notifications@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/notifications@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/notifications@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/notifications@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/notifications@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/notifications@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/notifications@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/notifications@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/notifications@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/notifications@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/notifications@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/notifications@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/notifications@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/notifications@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/notifications@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/notifications@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/notifications@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/notifications@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/notifications@0.21.0
  - @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/notifications@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/notifications@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/notifications@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/notifications@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/notifications@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/notifications@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/notifications@0.14.0
  - @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/notifications@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/notifications@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/notifications@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/notifications@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/notifications@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/notifications@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/notifications@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/notifications@0.6.9
- @voyantjs/react@0.6.9
