---
"@voyantjs/notifications-ui": minor
"@voyantjs/availability-ui": minor
"@voyantjs/bookings-ui": minor
"@voyantjs/suppliers-ui": minor
"@voyantjs/resources-ui": minor
"@voyantjs/promotions-ui": minor
---

i18n for the packaged admin hosts: all hardcoded UI copy that moved into
packages with the packaged-admin migration now flows through the
package-owned message bundles.

- `@voyantjs/notifications-ui`: the admin hosts (templates page/dialog/
  detail, deliveries + delivery detail, reminder rules/dialog/detail,
  reminder runs, reminders preview, authoring help) consume a new
  `admin` section of `NotificationsUiMessages` via
  `useNotificationsUiMessagesOrDefault()` — ~190 new message keys with
  English and Romanian definitions, grouped by component
  (`admin.common`, `admin.templatesPage`, `admin.templateDialog`,
  `admin.templateDetail`, `admin.deliveriesPage`, `admin.deliveryDetail`,
  `admin.reminderRulesPage`, `admin.reminderRuleDialog`,
  `admin.reminderRuleDetail`, `admin.reminderRunsPage`,
  `admin.previewPage`, `admin.authoringHelp`).
- `@voyantjs/availability-ui`, `@voyantjs/bookings-ui`,
  `@voyantjs/suppliers-ui`, `@voyantjs/resources-ui`,
  `@voyantjs/promotions-ui`: the admin extension factories switch from a
  singular `label?: string` option to the `labels?: { <domain>?: string }`
  shape the other domain factories (catalog, crm, legal, finance) already
  use — hosts pass localized titles per domain key. The availability
  start-time detail host's breadcrumb fallback now resolves through the
  operator admin message catalog instead of a hardcoded string.
