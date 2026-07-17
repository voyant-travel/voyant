/**
 * Compatibility check between an extension's declared `extensionApi` range and
 * the admin's implemented API version.
 *
 * The matcher now lives in the dependency-free `@voyant-travel/admin-extension-sdk`
 * so the render-time host gate and the installation-time apps resolver evaluate
 * compatibility with one implementation. Re-exported here to keep the admin
 * import path (`./compat.js`) stable.
 */
export { isUiExtensionCompatible } from "@voyant-travel/admin-extension-sdk"
