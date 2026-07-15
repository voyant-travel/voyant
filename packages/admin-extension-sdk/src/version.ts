/**
 * Semver version of the admin UI-extension API this SDK implements.
 *
 * Extensions declare a compatible RANGE in their manifest's `extensionApi`
 * field; the admin host evaluates that range against this constant at render
 * time (see `isUiExtensionCompatible`). Bump the MAJOR when the protocol or
 * the resolved-descriptor shape changes in a breaking way; bump the MINOR when
 * adding backwards-compatible surface (e.g. a new slot).
 */
export const ADMIN_UI_EXTENSION_API_VERSION = "1.0.0"
