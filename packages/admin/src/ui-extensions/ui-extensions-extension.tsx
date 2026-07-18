"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  UiExtensionContext,
  UiExtensionDescriptor,
  UiExtensionEntity,
  UiExtensionOrg,
  UiExtensionTextDirection,
  UiExtensionToastIntent,
  UiExtensionViewer,
} from "@voyant-travel/admin-extension-sdk"
import { createContext, useContext } from "react"

import { type AdminExtension, defineAdminExtension } from "../extensions.js"
import { useLocale } from "../providers/locale.js"
import { useTheme } from "../providers/theme.js"
import { ADMIN_UI_EXTENSION_SLOTS } from "./registry.js"
import { UiExtensionHost, type UiExtensionSessionTokenGrant } from "./ui-extension-host.js"

/**
 * A resolved descriptor as the installation-backed client returns it: the SDK
 * descriptor shape plus the host-resolved app locale/direction and the owning
 * installation. Static self-hosted descriptors omit the extra fields and fall
 * back to the active locale / `ltr`.
 */
export interface InstalledUiExtension extends UiExtensionDescriptor {
  /** Owning installation, used to broker a session token for the frame. */
  installationId?: string
  /** App locale the host resolved from the release's declared locales. */
  appLocale?: string
  /** Text direction for {@link appLocale}. */
  direction?: UiExtensionTextDirection
}

/** Read-side dependency the factory uses to list an org's installed extensions. */
export interface UiExtensionsClient {
  list(): Promise<InstalledUiExtension[]>
  /** Full-page app extensions mounted under the app-owned admin route. */
  listPages?(): Promise<AppPageDescriptor[]>
}

/** A resolved full-page app extension (app-owned admin route + nav entry). */
export interface AppPageDescriptor {
  /** Stable per-installation key. */
  key: string
  installationId?: string
  /** App-owned admin sub-path (mounted under the apps route segment). */
  path: string
  entryUrl: string
  /** Host-rendered page title (locale-resolved). */
  title: string
  /** Host-rendered navigation label. */
  navLabel: string
  appLocale?: string
  direction?: UiExtensionTextDirection
}

/** Context the host passes when brokering a session token for a frame. */
export interface UiExtensionTokenRequest {
  descriptor: InstalledUiExtension
  slot: string
  entity?: UiExtensionEntity | null
}

/** Brokers a short-lived session token for a frame (null answers `unavailable`). */
export type UiExtensionTokenBroker = (
  request: UiExtensionTokenRequest,
) => Promise<UiExtensionSessionTokenGrant | null>

/**
 * Ambient wiring an extension host needs that is NOT derivable from the theme
 * and locale providers: which org/viewer the surface belongs to, the entity a
 * detail surface is scoped to, and how host actions reach the admin shell.
 */
export interface UiExtensionEnvironment {
  org: UiExtensionOrg
  viewer: UiExtensionViewer
  entity?: UiExtensionEntity | null
  onNavigate?: (to: string) => void
  onToast?: (intent: UiExtensionToastIntent, message: string) => void
  /**
   * Brokers a session token when a frame sends `request-token`. When omitted,
   * the host answers `not-supported`. The platform wiring supplies this to mint
   * a token via the apps module for the descriptor's installation and context.
   */
  requestToken?: UiExtensionTokenBroker
}

const UiExtensionEnvironmentContext = createContext<UiExtensionEnvironment | undefined>(undefined)

export interface UiExtensionEnvironmentProviderProps {
  value: UiExtensionEnvironment
  children: React.ReactNode
}

export function UiExtensionEnvironmentProvider({
  value,
  children,
}: UiExtensionEnvironmentProviderProps) {
  return (
    <UiExtensionEnvironmentContext.Provider value={value}>
      {children}
    </UiExtensionEnvironmentContext.Provider>
  )
}

export function useUiExtensionEnvironment(): UiExtensionEnvironment | undefined {
  return useContext(UiExtensionEnvironmentContext)
}

/**
 * Static client for self-hosted wiring: the install set is known at boot rather
 * than fetched. The cloud platform supplies a fetching client instead.
 */
export function createStaticUiExtensionsClient(
  descriptors: ReadonlyArray<InstalledUiExtension>,
): UiExtensionsClient {
  const snapshot = [...descriptors]
  return { list: async () => snapshot }
}

/**
 * Installation-backed client: the cloud/apps layer resolves activated
 * descriptors from `app_extension_installations` (active installations only,
 * compatibility-filtered, host labels + app locale/direction resolved) and this
 * client just fetches that snapshot. Pausing/uninstalling an app drops it from
 * the fetched list, so its frames unmount on the next refetch.
 */
export function createInstallationUiExtensionsClient(
  fetchInstalled: () => Promise<InstalledUiExtension[]>,
  fetchPages?: () => Promise<AppPageDescriptor[]>,
): UiExtensionsClient {
  // Without a page fetcher `useInstalledAppPages` would return [] and the
  // installation-sourced full-page app extensions/navigation added here would
  // be unreachable through this factory.
  return fetchPages ? { list: fetchInstalled, listPages: fetchPages } : { list: fetchInstalled }
}

/** Shared query key so every slot widget reads a single `client.list()` result. */
export const UI_EXTENSIONS_QUERY_KEY = ["voyant", "admin", "ui-extensions"] as const

let warnedListError = false

function useInstalledUiExtensions(client: UiExtensionsClient) {
  return useQuery({
    queryKey: UI_EXTENSIONS_QUERY_KEY,
    queryFn: () => client.list(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

function SlotUiExtensions({ client, slot }: { client: UiExtensionsClient; slot: string }) {
  const environment = useUiExtensionEnvironment()
  const { resolvedTheme } = useTheme()
  const { resolvedLocale } = useLocale()
  const query = useInstalledUiExtensions(client)

  if (query.isError) {
    if (!warnedListError) {
      warnedListError = true
      console.warn("[voyant-admin] Failed to list UI extensions; rendering none.", query.error)
    }
    return null
  }

  if (!environment || !query.data) return null

  const descriptors = query.data.filter((descriptor) => descriptor.slots.includes(slot))
  if (descriptors.length === 0) return null

  const entity = environment.entity ?? null

  return (
    <>
      {descriptors.map((descriptor) => {
        // The app locale/direction are per-app (release-pinned); a static
        // descriptor without them falls back to the active locale / ltr.
        const context: UiExtensionContext = {
          org: environment.org,
          viewer: environment.viewer,
          entity,
          theme: resolvedTheme,
          locale: resolvedLocale,
          appLocale: descriptor.appLocale ?? resolvedLocale,
          direction: descriptor.direction ?? "ltr",
        }
        const broker = environment.requestToken
        return (
          <UiExtensionHost
            key={descriptor.key}
            descriptor={descriptor}
            slot={slot}
            context={context}
            onNavigate={environment.onNavigate}
            onToast={environment.onToast}
            onRequestToken={broker ? () => broker({ descriptor, slot, entity }) : undefined}
          />
        )
      })}
    </>
  )
}

export interface CreateUiExtensionsAdminExtensionOptions {
  client: UiExtensionsClient
}

/**
 * Build a standard admin extension that mounts installed UI extensions into
 * every public slot. It contributes one widget per registry slot; each widget
 * reads the shared install list and renders a {@link UiExtensionHost} per
 * descriptor that targets the slot. List failures render nothing (fail-soft).
 */
export function createUiExtensionsAdminExtension({
  client,
}: CreateUiExtensionsAdminExtensionOptions): AdminExtension {
  return defineAdminExtension({
    id: "voyant-ui-extensions",
    widgets: ADMIN_UI_EXTENSION_SLOTS.map((slot) => ({
      id: `voyant-ui-extensions:${slot}`,
      slot,
      component: function UiExtensionsSlotWidget() {
        return <SlotUiExtensions client={client} slot={slot} />
      },
    })),
  })
}
