import { describe, expect, it } from "vitest"

import { createNotificationsAdminExtension } from "./index.js"
import { NotificationDeliveriesHost } from "./notification-deliveries-host.js"
import { NotificationDeliveryDetailDialog } from "./notification-delivery-detail-dialog.js"
import { NotificationReminderRuleDetailHost } from "./notification-reminder-rule-detail-host.js"
import { NotificationReminderRuleDialog } from "./notification-reminder-rule-dialog.js"
import { NotificationReminderRulesHost } from "./notification-reminder-rules-host.js"
import { NotificationReminderRunsHost } from "./notification-reminder-runs-host.js"
import { NotificationSettingsHost } from "./notification-settings-host.js"
import { NotificationTemplateDetailHost } from "./notification-template-detail-host.js"
import { NotificationTemplateDialog } from "./notification-template-dialog.js"
import { NotificationTemplatesHost } from "./notification-templates-host.js"
import { RemindersPreviewHost } from "./reminders-preview-host.js"

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

  it("carries lazy pages only (no loader, no SSR override, no eager component)", () => {
    // RFC §4.8 endgame: contributions ship the implementation, hosts bind
    // them into their code-assembled route tree. The notifications pages
    // fetch client-side with component-local filter state, so contributions
    // carry a lazy `page` module loader and nothing else.
    const extension = createNotificationsAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(8)
    for (const route of routes) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      expect(route.loader).toBeUndefined()
      expect(route.ssr).toBeUndefined()
    }
  })

  it("resolves every lazy page to a module with a default component", async () => {
    const extension = createNotificationsAdminExtension()
    for (const route of extension.routes ?? []) {
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
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
