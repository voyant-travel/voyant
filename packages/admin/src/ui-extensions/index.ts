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
export { isUiExtensionCompatible } from "./compat.js"
export {
  ADMIN_UI_EXTENSION_SLOTS,
  type AdminUiExtensionSlot,
  isAdminUiExtensionSlot,
} from "./registry.js"
export { UiExtensionHost, type UiExtensionHostProps } from "./ui-extension-host.js"
export {
  type CreateUiExtensionsAdminExtensionOptions,
  createStaticUiExtensionsClient,
  createUiExtensionsAdminExtension,
  UI_EXTENSIONS_QUERY_KEY,
  type UiExtensionEnvironment,
  UiExtensionEnvironmentProvider,
  type UiExtensionEnvironmentProviderProps,
  type UiExtensionsClient,
  useUiExtensionEnvironment,
} from "./ui-extensions-extension.js"
