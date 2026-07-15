/**
 * Shared value types for the admin UI-extension contract.
 *
 * These shapes are the cross-repo contract between the framework host, the
 * cloud platform (which resolves manifests into {@link UiExtensionDescriptor}),
 * and the author SDK. Keep them dependency-free and serializable — every value
 * here crosses the `postMessage` boundary or is embedded in a resolved
 * descriptor.
 */

/** The organization an extension is rendered for. */
export interface UiExtensionOrg {
  slug: string
  name: string
}

/** The admin user viewing the surface an extension is mounted in. */
export interface UiExtensionViewer {
  id: string
  displayName: string
}

/** The domain record a detail surface is scoped to (null on list/dashboard surfaces). */
export interface UiExtensionEntity {
  type: string
  id: string
}

export type UiExtensionTheme = "light" | "dark"

/**
 * Read-only host context handed to an extension at init and on every update.
 * Never carries secrets — the frame is cross-origin and source-checked only.
 */
export interface UiExtensionContext {
  org: UiExtensionOrg
  viewer: UiExtensionViewer
  entity: UiExtensionEntity | null
  theme: UiExtensionTheme
  locale: string
}

/**
 * A manifest resolved into the shape the host consumes. The cloud platform
 * resolves and validates extension manifests into this; the framework host
 * never parses raw manifests.
 */
export interface UiExtensionDescriptor {
  key: string
  version: string
  displayName: string
  /** Semver RANGE the extension supports (e.g. `"^1"`, `"1.x"`, `"1.2.3"`). */
  extensionApi: string
  /** Absolute URL of the extension bundle mounted in the sandboxed iframe. */
  entryUrl: string
  /** Slot ids this extension targets. */
  slots: string[]
  /** Opaque per-install configuration forwarded to the extension at init. */
  config?: Record<string, unknown>
}

export type UiExtensionToastIntent = "info" | "success" | "error"
