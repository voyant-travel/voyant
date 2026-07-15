---
"@voyant-travel/admin": minor
"@voyant-travel/admin-extension-sdk": minor
---

Add the versioned admin UI-extension host: a public slot registry
(`ADMIN_UI_EXTENSION_SLOTS`), a render-time compatibility check
(`isUiExtensionCompatible`), a sandboxed-iframe `UiExtensionHost` implementing
the `postMessage` protocol, and `createUiExtensionsAdminExtension` /
`createStaticUiExtensionsClient` for mounting installed extensions into every
slot. Re-exports the contract and version constant from the new
`@voyant-travel/admin-extension-sdk`.
