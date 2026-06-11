import { describe, expect, it } from "vitest"

import {
  createNotificationsAdminExtension,
  NotificationDeliveriesHost,
  NotificationDeliveryDetailDialog,
  NotificationReminderRuleDetailHost,
  NotificationReminderRuleDialog,
  NotificationReminderRulesHost,
  NotificationReminderRunsHost,
  NotificationSettingsHost,
  NotificationTemplateDetailHost,
  NotificationTemplateDialog,
  NotificationTemplatesHost,
  RemindersPreviewHost,
} from "./index.js"

describe("createNotificationsAdminExtension", () => {
  it("contributes no navigation (notifications nav is base-nav-owned)", () => {
    const extension = createNotificationsAdminExtension()
    expect(extension.id).toBe("notifications")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the notifications routes with unique ids and paths", () => {
    const extension = createNotificationsAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(8)
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length)
    expect(routes.map((route) => route.path)).toEqual([
      "/notifications/templates",
      "/notifications/templates/$id",
      "/notifications/reminder-rules",
      "/notifications/reminder-rules/$id",
      "/notifications/deliveries",
      "/notifications/reminder-runs",
      "/notifications/preview",
      "/notifications/settings",
    ])
  })

  it("honors basePath and labels", () => {
    const extension = createNotificationsAdminExtension({
      basePath: "/notificari",
      labels: { templates: "Sabloane", reminderRules: "Reguli reminder" },
    })
    const templatesIndex = extension.routes?.find(
      (route) => route.id === "notifications-templates-index",
    )
    expect(templatesIndex?.path).toBe("/notificari/templates")
    expect(templatesIndex?.title).toBe("Sabloane")
    const rulesDetail = extension.routes?.find(
      (route) => route.id === "notifications-reminder-rules-detail",
    )
    expect(rulesDetail?.path).toBe("/notificari/reminder-rules/$id")
    expect(rulesDetail?.title).toBe("Reguli reminder")
  })

  it("does not attach components to route contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; the notifications
    // detail hosts take the record id as a prop, so host route files stay
    // the binding layer until the RFC §4.2 code-based route assembly lands.
    const extension = createNotificationsAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })

  it("contributes no widgets (no cross-domain notifications card is slot-mounted today)", () => {
    const extension = createNotificationsAdminExtension()
    expect(extension.widgets).toBeUndefined()
  })
})

describe("packaged notifications admin hosts", () => {
  // Importable + renderable component types — the operator's thin route
  // hosts bind these directly, so a broken import surface fails here, not
  // in an app build. (Behavioral rendering needs the workspace provider
  // stack and lives with the host apps.)
  it("exports the page hosts and dialogs as components from the admin entrypoint", () => {
    for (const host of [
      NotificationDeliveriesHost,
      NotificationDeliveryDetailDialog,
      NotificationReminderRuleDetailHost,
      NotificationReminderRuleDialog,
      NotificationReminderRulesHost,
      NotificationReminderRunsHost,
      NotificationSettingsHost,
      NotificationTemplateDetailHost,
      NotificationTemplateDialog,
      NotificationTemplatesHost,
      RemindersPreviewHost,
    ]) {
      expect(typeof host).toBe("function")
    }
  })
})
