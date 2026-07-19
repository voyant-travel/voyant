/**
 * Admin UI-extension host surface: the public slot registry, the render-time
 * compatibility check, the sandboxed iframe host, and the admin-extension
 * factory that mounts installed extensions into every slot.
 *
 * The versioned contract itself (protocol, author client, value types) lives
 * in `@voyant-travel/admin-extension-sdk`; the version constant and value
 * types are re-exported here so host wiring has a single import.
 */

// Re-exported contract so hosts import the version + shared value types from
// the admin package alongside the host component.
export {
  ADMIN_UI_EXTENSION_API_VERSION,
  type UiExtensionContext,
  type UiExtensionDescriptor,
  type UiExtensionEntity,
  type UiExtensionOrg,
  type UiExtensionTheme,
  type UiExtensionToastIntent,
  type UiExtensionViewer,
} from "@voyant-travel/admin-extension-sdk"
export {
  APP_PAGES_QUERY_KEY,
  AppExtensionPage,
  type AppExtensionPageProps,
  type AppPageNavEntry,
  useAppPageNavEntries,
  useInstalledAppPages,
} from "./app-pages.js"
export { isUiExtensionCompatible } from "./compat.js"
export {
  ADMIN_UI_EXTENSION_SLOTS,
  type AdminUiExtensionSlot,
  isAdminUiExtensionSlot,
} from "./registry.js"
export {
  UiExtensionHost,
  type UiExtensionHostProps,
  type UiExtensionRequestTokenHandler,
  type UiExtensionSessionTokenGrant,
} from "./ui-extension-host.js"
export {
  APP_PAGE_ROUTE_ID,
  APP_PAGE_ROUTE_PATH,
  type AppPageDescriptor,
  type CreateUiExtensionsAdminExtensionOptions,
  createInstallationUiExtensionsClient,
  createStaticUiExtensionsClient,
  createUiExtensionsAdminExtension,
  type InstalledUiExtension,
  UI_EXTENSIONS_QUERY_KEY,
  type UiExtensionEnvironment,
  UiExtensionEnvironmentProvider,
  type UiExtensionEnvironmentProviderProps,
  type UiExtensionsClient,
  type UiExtensionTokenBroker,
  type UiExtensionTokenRequest,
  useUiExtensionEnvironment,
} from "./ui-extensions-extension.js"
