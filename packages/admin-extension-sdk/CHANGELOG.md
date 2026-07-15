# @voyant-travel/admin-extension-sdk

## 0.1.1

### Patch Changes

- 2e34e64: Republish with packaged `dist` exports. The 0.1.0 tarball was published outside
  the release train, so its `exports` map pointed at unpackaged `src/*.ts` files
  and the package could not be imported.

## 0.1.0

### Minor Changes

- c1e37f2: Add the versioned admin UI-extension host: a public slot registry
  (`ADMIN_UI_EXTENSION_SLOTS`), a render-time compatibility check
  (`isUiExtensionCompatible`), a sandboxed-iframe `UiExtensionHost` implementing
  the `postMessage` protocol, and `createUiExtensionsAdminExtension` /
  `createStaticUiExtensionsClient` for mounting installed extensions into every
  slot. Re-exports the contract and version constant from the new
  `@voyant-travel/admin-extension-sdk`.
