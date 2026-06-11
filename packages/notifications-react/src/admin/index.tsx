import { type AdminExtension, adminRoutePageModule, defineAdminExtension } from "@voyantjs/admin"

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
 * ROUTES: full implementations (packaged-admin RFC §4.8 endgame) — each
 * contribution carries a lazy `page` module loader, so hosts bind them
 * through their code-assembled admin route tree with no per-route files.
 * The notifications pages keep their filter state component-local and fetch
 * client-side, so contributions carry no loader, no search contract and no
 * SSR override. {@link NotificationTemplatesHost},
 * {@link NotificationReminderRulesHost}, {@link NotificationDeliveriesHost},
 * {@link NotificationReminderRunsHost}, {@link RemindersPreviewHost} and
 * {@link NotificationSettingsHost} are zero-prop; the detail contributions
 * resolve wrapper pages (`./pages/*`) that bind the matched `$id` param onto
 * {@link NotificationTemplateDetailHost} and
 * {@link NotificationReminderRuleDetailHost}. Pages stay code-split because
 * every `page` is a dynamic import of the specific host module, never a
 * static reference from this factory.
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
        page: () =>
          import("./notification-templates-host.js").then((module) =>
            adminRoutePageModule(module.NotificationTemplatesHost),
          ),
      },
      {
        id: "notifications-templates-detail",
        path: `${basePath}/templates/$id`,
        title: templates,
        page: () => import("./pages/notification-template-detail-page.js"),
      },
      {
        id: "notifications-reminder-rules-index",
        path: `${basePath}/reminder-rules`,
        title: reminderRules,
        page: () =>
          import("./notification-reminder-rules-host.js").then((module) =>
            adminRoutePageModule(module.NotificationReminderRulesHost),
          ),
      },
      {
        id: "notifications-reminder-rules-detail",
        path: `${basePath}/reminder-rules/$id`,
        title: reminderRules,
        page: () => import("./pages/notification-reminder-rule-detail-page.js"),
      },
      {
        id: "notifications-deliveries",
        path: `${basePath}/deliveries`,
        title: deliveries,
        page: () =>
          import("./notification-deliveries-host.js").then((module) =>
            adminRoutePageModule(module.NotificationDeliveriesHost),
          ),
      },
      {
        id: "notifications-reminder-runs",
        path: `${basePath}/reminder-runs`,
        title: reminderRuns,
        page: () =>
          import("./notification-reminder-runs-host.js").then((module) =>
            adminRoutePageModule(module.NotificationReminderRunsHost),
          ),
      },
      {
        id: "notifications-preview",
        path: `${basePath}/preview`,
        title: preview,
        page: () =>
          import("./reminders-preview-host.js").then((module) =>
            adminRoutePageModule(module.RemindersPreviewHost),
          ),
      },
      {
        id: "notifications-settings",
        path: `${basePath}/settings`,
        title: settings,
        page: () =>
          import("./notification-settings-host.js").then((module) =>
            adminRoutePageModule(module.NotificationSettingsHost),
          ),
      },
    ],
  })
}
