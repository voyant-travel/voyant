import { adminRoutePageModule } from "@voyant-travel/admin/extensions"
import type { AdminCoreSettingsExtraPage } from "@voyant-travel/admin-app/core-extension"
import { Building } from "lucide-react"

/**
 * Options for {@link createOperatorProfileSettingsExtraPage}. All optional —
 * the defaults reproduce the operator starter's placement (General group,
 * leading order 10, Building icon) so a source-free admin renders the page
 * identically.
 */
export interface OperatorProfileSettingsExtraPageOptions {
  /** Path relative to the settings base path. Default `"/operator"`. */
  path?: string
  /** Position within the General group. Default `10` (leads the group). */
  order?: number
}

/**
 * The packaged Operator Profile settings page as an
 * {@link AdminCoreSettingsExtraPage} descriptor. Spread the result into
 * `createAdminCoreExtension({ settings: { extraPages: [...] } })` to mount the
 * page — the same shape the operator starter uses, but source-free so the
 * managed (package-only) admin can render it.
 *
 * The `page` thunk lazy-imports the heavy React page so it stays out of the
 * chunk that evaluates the extension registry.
 */
export function createOperatorProfileSettingsExtraPage(
  options: OperatorProfileSettingsExtraPageOptions = {},
): AdminCoreSettingsExtraPage {
  return {
    id: "operator",
    path: options.path ?? "/operator",
    title: "Operator Profile",
    label: (messages) => messages.settings.operator,
    icon: Building,
    group: "general",
    order: options.order ?? 10,
    page: () =>
      import("./operator-profile-settings-page.js").then((module) =>
        adminRoutePageModule(module.OperatorProfileSettingsPage),
      ),
  }
}
