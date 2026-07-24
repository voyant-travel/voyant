import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyant-travel/admin/extensions"
import type { AdminCoreSettingsExtraPage } from "@voyant-travel/admin-app/core-extension"
import { Webhook } from "lucide-react"

export function createOperatorWebhooksSettingsExtraPage(): AdminCoreSettingsExtraPage {
  return {
    id: "webhooks",
    path: "/webhooks",
    title: "Webhooks",
    label: (messages) => messages.settings.webhooks,
    icon: Webhook,
    group: "general",
    order: 35,
    ssr: false,
    page: () =>
      import("./webhooks-settings-page.js").then((module) =>
        adminRoutePageModule(module.WebhooksSettingsPage),
      ),
  }
}

/** Selected-graph settings contribution for operator business-event webhooks. */
export function createSelectedOperatorWebhooksAdminExtension(): AdminExtension {
  return defineAdminExtension({
    id: "operator-webhooks",
    settingsPages: [createOperatorWebhooksSettingsExtraPage()],
    routes: [
      {
        id: "operator-webhooks-detail",
        path: "/settings/webhooks/$subscriptionId",
        title: "Webhook subscription",
        ssr: false,
        page: () =>
          import("./webhook-subscription-detail-page.js").then((module) =>
            adminRoutePageModule(module.WebhookSubscriptionDetailPage),
          ),
      },
    ],
  })
}
