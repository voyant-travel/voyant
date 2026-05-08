---
"@voyantjs/notifications-ui": minor
"@voyantjs/notifications-react": minor
"@voyantjs/admin": patch
"@voyantjs/i18n": patch
---

Reminder sequences UI (#488).

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
