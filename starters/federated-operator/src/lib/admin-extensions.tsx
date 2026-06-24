import { createActionLedgerAdminExtension } from "@voyant-travel/action-ledger-react/admin"
import {
  type AdminExtension,
  adminRoutePageModule,
  createAdminExtensionRegistry,
  defineAdminExtension,
} from "@voyant-travel/admin/extensions"
import { createRelationshipsAdminExtension } from "@voyant-travel/relationships-react/admin"
import { DatabaseZap, Gauge, PlugZap, ScrollText, Settings, Workflow } from "lucide-react"

function createFederatedCoreExtension(): AdminExtension {
  return defineAdminExtension({
    id: "federated-core",
    navigation: [
      {
        insertAfter: "dashboard",
        order: 10,
        items: [
          {
            id: "source-connections",
            title: "Source connections",
            url: "/sources",
            icon: PlugZap,
          },
          {
            id: "workflow-runs",
            title: "Workflow runs",
            url: "/workflow-runs",
            icon: Workflow,
          },
        ],
      },
    ],
    routes: [
      {
        id: "federated-dashboard",
        path: "/",
        title: "Federated operator",
        page: () =>
          import("@/admin/pages/dashboard").then((module) =>
            adminRoutePageModule(module.FederatedDashboardPage),
          ),
      },
      {
        id: "source-connections-index",
        path: "/sources",
        title: "Source connections",
        page: () =>
          import("@/admin/pages/source-connections").then((module) =>
            adminRoutePageModule(module.SourceConnectionsPage),
          ),
      },
      {
        id: "workflow-runs-index",
        path: "/workflow-runs",
        title: "Workflow runs",
        page: () =>
          import("@/admin/pages/workflow-runs").then((module) =>
            adminRoutePageModule(module.WorkflowRunsAdminPage),
          ),
      },
      {
        id: "federated-settings",
        path: "/settings",
        title: "Settings",
        page: () =>
          import("@/admin/pages/settings").then((module) =>
            adminRoutePageModule(module.FederatedSettingsPage),
          ),
      },
    ],
  })
}

export function createFederatedAdminExtensions(): ReadonlyArray<AdminExtension> {
  return createAdminExtensionRegistry(
    createFederatedCoreExtension(),
    createRelationshipsAdminExtension({
      labels: {
        people: "People",
        organizations: "Organizations",
      },
    }),
    createActionLedgerAdminExtension({
      labels: { actionLedger: "Action ledger" },
      icon: ScrollText,
      order: 70,
    }),
  )
}

export const federatedBaseNav = [
  {
    id: "dashboard",
    title: "Dashboard",
    url: "/",
    icon: Gauge,
  },
  {
    id: "people",
    title: "People",
    url: "/people",
    icon: DatabaseZap,
  },
  {
    id: "organizations",
    title: "Organizations",
    url: "/organizations",
    icon: DatabaseZap,
  },
] as const

export const federatedAdminIcons = {
  settings: Settings,
} as const
