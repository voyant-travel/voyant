import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
} from "@voyant-travel/admin/extensions"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import {
  createAdminHostExtensions,
  defaultAdminHostNavMessages,
  discoverAdminHostExtensions,
  loadAdminDashboard,
} from "@voyant-travel/admin-host/presentation"
import { createOperatorProfileSettingsExtraPage } from "@voyant-travel/operator-settings-react/settings"
import { SlidersHorizontal } from "lucide-react"

import { effectiveAccessCatalog } from "../../.voyant/access/selected-access-catalog.generated"
import { createSelectedGraphAdminExtensions } from "../../.voyant/admin/selected-graph-admin.generated"

function createCoreExtension() {
  return createAdminCoreExtension({
    dashboard: { loader: loadAdminDashboard },
    settings: {
      accessCatalog: effectiveAccessCatalog,
      extraPages: [
        createOperatorProfileSettingsExtraPage(),
        {
          id: "custom-fields",
          path: "/custom-fields",
          title: "Custom Fields",
          label: "Custom fields",
          icon: SlidersHorizontal,
          group: "general",
          order: 75,
          ssr: "data-only",
          page: () =>
            import(
              "@voyant-travel/relationships-react/components/custom-field-definitions-page"
            ).then((module) => adminRoutePageModule(module.CustomFieldDefinitionsPage)),
          loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
            const [{ defaultFetcher }, { getCustomFieldDefinitionsQueryOptions }] =
              await Promise.all([
                import("@voyant-travel/relationships-react/client"),
                import("@voyant-travel/relationships-react"),
              ])
            return queryClient.ensureQueryData(
              getCustomFieldDefinitionsQueryOptions(
                { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher },
                { limit: 25, offset: 0 },
              ),
            )
          },
        },
      ],
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
    core: createCoreExtension(),
    selected: createSelectedGraphAdminExtensions,
    navMessages,
    discovered: discoveredAdminExtensions,
  })
}

export const adminExtensions = createOperatorAdminExtensions(defaultAdminHostNavMessages)
