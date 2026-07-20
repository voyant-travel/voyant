"use client"

import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin"
import { Images } from "lucide-react"

import { MediaLibrary, type MediaLibraryProps } from "../components/media-library.js"
import { MediaUiMessagesProvider } from "../i18n/provider.js"

export interface MediaLibraryAdminViewProps extends MediaLibraryProps {
  /** Active UI locale (falls back to English inside the messages provider). */
  locale?: string | null
  /** IANA time zone for locale-aware formatting. */
  timeZone?: string | null
}

/**
 * A ready-to-mount media-library admin view: the browse surface wrapped in its
 * own messages provider so a host can drop it onto a page without wiring the
 * i18n context itself. The selected-graph nav integration below reuses the same
 * `MediaUiMessagesProvider` as the route messages provider.
 */
export function MediaLibraryAdminView({ locale, timeZone, ...props }: MediaLibraryAdminViewProps) {
  return (
    <MediaUiMessagesProvider locale={locale ?? null} timeZone={timeZone}>
      <MediaLibrary {...props} />
    </MediaUiMessagesProvider>
  )
}

export interface CreateMediaAdminExtensionOptions {
  /**
   * Mount path of the media library inside the admin workspace. Default
   * `/media-library`.
   */
  basePath?: string
  /** Localized nav/page labels. Defaults to the English operator nav label. */
  labels?: {
    mediaLibrary?: string
  }
  /** Nav icon — icon choice stays with the host (e.g. lucide `Images`). */
  icon?: NavItem["icon"]
}

/**
 * The media-library admin contribution (packaged-admin RFC Phase 3,
 * `@voyant-travel/<domain>-react/admin` convention; voyant#3555).
 *
 * NAVIGATION: package-delivered. The Media library item is NOT part of the BASE
 * operator navigation, so the extension contributes it — spliced directly after
 * Bookings via `insertAfter`, alongside the other operationally-managed
 * catalogue surfaces. The icon stays a host choice.
 *
 * ROUTES: a single contribution carries the FULL browse surface at `basePath`,
 * where operators upload, organise, and inspect catalogued assets. All library
 * data flows through the shared `@voyant-travel/react` provider mounted by the
 * workspace shell (client-side hooks), so the route needs no SSR loader; the
 * localized copy arrives via the `MediaUiMessagesProvider` route messages
 * provider.
 *
 * WIDGETS: none contributed and no slots exposed yet.
 */
export function createMediaAdminExtension(
  options: CreateMediaAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/media-library", labels = {}, icon } = options
  const { mediaLibrary = "Media library" } = labels

  return defineAdminExtension({
    id: "media",
    navigation: [
      {
        insertAfter: "bookings",
        items: [{ id: "media-library", title: mediaLibrary, url: basePath, icon }],
      },
    ],
    routes: [
      {
        id: "media-library-index",
        path: basePath,
        title: mediaLibrary,
        ssr: "data-only",
        routeMessagesProvider: mediaRouteMessagesProvider,
        page: () =>
          import("./media-library-host.js").then((module) =>
            adminRoutePageModule(module.MediaLibraryHost),
          ),
      },
    ],
  })
}

/** Selected-graph adapter owning the standard Operator copy key and icon. */
export function createSelectedMediaAdminExtension(
  { navMessages }: SelectedAdminExtensionFactoryContext = { navMessages: {} },
): AdminExtension {
  return createMediaAdminExtension({
    labels: { mediaLibrary: navMessages.mediaLibrary ?? "Media library" },
    icon: Images,
  })
}

function mediaRouteMessagesProvider() {
  return import("../i18n/provider.js").then((module) => ({
    default: module.MediaUiMessagesProvider,
  }))
}
