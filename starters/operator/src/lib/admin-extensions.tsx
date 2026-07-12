import type { AdminExtension, AdminSettingsPageContribution } from "@voyant-travel/admin/extensions"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import {
  createAdminHostExtensions,
  defaultAdminHostNavMessages,
  discoverAdminHostExtensions,
  loadAdminDashboard,
} from "@voyant-travel/admin-host/presentation"
import { effectiveAccessCatalog } from "../../.voyant/access/selected-access-catalog.generated"
import { createSelectedGraphAdminExtensions } from "../../.voyant/admin/selected-graph-admin.generated"

function createCoreExtension(settingsPages: ReadonlyArray<AdminSettingsPageContribution>) {
  return createAdminCoreExtension({
    dashboard: { loader: loadAdminDashboard },
    settings: {
      accessCatalog: effectiveAccessCatalog,
      extraPages: settingsPages,
    },
  })
}

export const discoveredAdminExtensions = discoverAdminHostExtensions(
  import.meta.glob("../admin/*/index.tsx", { eager: true }),
)

export function createOperatorAdminExtensions(
  navMessages: Readonly<Record<string, string>>,
): ReadonlyArray<AdminExtension> {
  return createAdminHostExtensions({
    core: createCoreExtension,
    selected: createSelectedGraphAdminExtensions,
    navMessages,
    discovered: discoveredAdminExtensions,
  })
}

export const adminExtensions = createOperatorAdminExtensions(defaultAdminHostNavMessages)
