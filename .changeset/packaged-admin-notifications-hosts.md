---
"@voyantjs/notifications-ui": minor
"@voyantjs/ui": minor
---

Packaged-admin RFC notifications pages delivered: the notification admin
pages move out of `@voyantjs/ui` into `@voyantjs/notifications-ui/admin`
as packaged hosts — `NotificationTemplatesHost`,
`NotificationTemplateDetailHost`, `NotificationReminderRulesHost`,
`NotificationReminderRuleDetailHost`, `NotificationDeliveriesHost`,
`NotificationReminderRunsHost`, `RemindersPreviewHost` and
`NotificationSettingsHost`, plus the `NotificationTemplateDialog`,
`NotificationReminderRuleDialog`, `NotificationDeliveryDetailDialog` and
`NotificationTemplateAuthoringHelp` building blocks. Cross-route links
resolve through new semantic destination keys (RFC §4.7):
`notificationTemplate.list`/`notificationTemplate.detail` and
`notificationReminderRule.list`/`notificationReminderRule.detail`, via
`useAdminHref` + `useAdminNavigate`. `createNotificationsAdminExtension`
contributes the eight notifications routes as metadata (no nav — the
Notifications group is base-nav-owned; no search contracts — every page
keeps its filter state component-local). The template detail host
lazy-loads the template dialog so tiptap/prosemirror stays out of the
detail-page chunk. New notifications-ui peers: `@voyantjs/admin`,
`lucide-react`, `react-hook-form`.

BREAKING for `@voyantjs/ui`: the notification page components are removed —
the `./components/notification-template-dialog`,
`./components/notification-templates-page`,
`./components/notification-reminder-rule-dialog`,
`./components/notification-reminder-rules-page`,
`./components/notification-deliveries-page`,
`./components/notification-reminder-runs-page` and
`./components/notification-template-authoring-help` subpath exports are
gone, as are the wildcard-only
`./components/notification-template-detail-page` and
`./components/notification-delivery-detail-dialog` modules. Import the
hosts from `@voyantjs/notifications-ui/admin` instead. `@voyantjs/ui` no
longer depends on `@voyantjs/notifications` /
`@voyantjs/notifications-react`.
