"use client"

import { MediaLibrary } from "../components/media-library.js"

/**
 * Packaged admin host for the media library (voyant#3555). The landing surface
 * for the media domain: browse folders, filter and upload assets, and inspect a
 * selected asset's usage. All data flows through the shared
 * `@voyant-travel/react` provider context mounted by the workspace shell, and
 * the localized copy arrives via the route's messages provider
 * (`MediaUiMessagesProvider`), so the host mounts the browse surface directly.
 */
export function MediaLibraryHost() {
  return <MediaLibrary />
}
