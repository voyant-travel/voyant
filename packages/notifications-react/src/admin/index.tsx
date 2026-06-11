import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"

/**
 * Semantic destinations the notifications admin surfaces navigate to
 * (packaged-admin RFC §4.7): the templates list/detail pair (list rows and
 * the detail page's back link) and the reminder rules list/detail pair
 * (the per-rule "Manage stages" link and the stage editor's back link).
 * All shapes are closed, so they are declared here directly.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The notification templates list page. */
    "notificationTemplate.list": Record<string, never>
    /** A notification template's detail page. */
    "notificationTemplate.detail": { templateId: string }
    /** The reminder rules list page. */
    "notificationReminderRule.list": Record<string, never>
    /** A reminder rule's detail page (stage sequence editor). */
    "notificationReminderRule.detail": { ruleId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the operator-grade
// notifications pages bound to their data wiring + semantic-destination
// navigation. Host route files only bind route params onto these.
export { NotificationDeliveriesHost } from "./notification-deliveries-host.js"
export { NotificationDeliveryDetailDialog } from "./notification-delivery-detail-dialog.js"
export {
  NotificationReminderRuleDetailHost,
  type NotificationReminderRuleDetailHostProps,
} from "./notification-reminder-rule-detail-host.js"
export { NotificationReminderRuleDialog } from "./notification-reminder-rule-dialog.js"
export { NotificationReminderRulesHost } from "./notification-reminder-rules-host.js"
export { NotificationReminderRunsHost } from "./notification-reminder-runs-host.js"
export { NotificationSettingsHost } from "./notification-settings-host.js"
export { NotificationTemplateAuthoringHelp } from "./notification-template-authoring-help.js"
export {
  NotificationTemplateDetailHost,
  type NotificationTemplateDetailHostProps,
} from "./notification-template-detail-host.js"
export { NotificationTemplateDialog } from "./notification-template-dialog.js"
export { NotificationTemplatesHost } from "./notification-templates-host.js"
export { RemindersPreviewHost } from "./reminders-preview-host.js"

export interface CreateNotificationsAdminExtensionOptions {
  /** Mount path of the notifications pages inside the admin workspace. Default `/notifications`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    templates?: string
    reminderRules?: string
    deliveries?: string
    reminderRuns?: string
    preview?: string
    settings?: string
  }
}

/**
 * The notifications admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Notifications nav group (templates,
 * reminder rules, deliveries, reminder runs, preview, settings) is part of
 * the BASE operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing nav entries here would duplicate
 * them. If the base nav ever drops the notifications group, this extension
 * is where the entries move.
 *
 * ROUTES: contributions are metadata only — the notifications pages keep
 * their filter state component-local, so there are no URL search contracts.
 * The PAGES are package-owned: {@link NotificationTemplatesHost},
 * {@link NotificationReminderRulesHost}, {@link NotificationDeliveriesHost},
 * {@link NotificationReminderRunsHost}, {@link RemindersPreviewHost} and
 * {@link NotificationSettingsHost} are zero-prop;
 * {@link NotificationTemplateDetailHost} and
 * {@link NotificationReminderRuleDetailHost} bind the detail pages to their
 * data wiring and resolve every cross-route link through the semantic
 * destinations declared above. `component:` is intentionally NOT attached
 * to these contributions yet: the contribution contract renders zero-prop
 * pages (route components read params via the router, per RFC §4.2), while
 * the detail hosts take the record id as a prop. Host route files stay the
 * thin binding layer (`Route.useParams()` → host props) until the §4.2
 * code-based route assembly gives packaged pages a router-agnostic way to
 * read route state.
 *
 * WIDGETS: none today. No cross-domain notifications card is slot-mounted —
 * deliveries shown on other domains' detail pages are those hosts' concern.
 */
export function createNotificationsAdminExtension(
  options: CreateNotificationsAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/notifications", labels = {} } = options
  const {
    templates = "Templates",
    reminderRules = "Reminder Rules",
    deliveries = "Deliveries",
    reminderRuns = "Reminder Runs",
    preview = "Preview",
    settings = "Settings",
  } = labels

  return defineAdminExtension({
    id: "notifications",
    routes: [
      {
        id: "notifications-templates-index",
        path: `${basePath}/templates`,
        title: templates,
      },
      {
        id: "notifications-templates-detail",
        path: `${basePath}/templates/$id`,
        title: templates,
      },
      {
        id: "notifications-reminder-rules-index",
        path: `${basePath}/reminder-rules`,
        title: reminderRules,
      },
      {
        id: "notifications-reminder-rules-detail",
        path: `${basePath}/reminder-rules/$id`,
        title: reminderRules,
      },
      {
        id: "notifications-deliveries",
        path: `${basePath}/deliveries`,
        title: deliveries,
      },
      {
        id: "notifications-reminder-runs",
        path: `${basePath}/reminder-runs`,
        title: reminderRuns,
      },
      {
        id: "notifications-preview",
        path: `${basePath}/preview`,
        title: preview,
      },
      {
        id: "notifications-settings",
        path: `${basePath}/settings`,
        title: settings,
      },
    ],
  })
}
