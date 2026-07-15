"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  UiExtensionContext,
  UiExtensionDescriptor,
  UiExtensionEntity,
  UiExtensionOrg,
  UiExtensionToastIntent,
  UiExtensionViewer,
} from "@voyant-travel/admin-extension-sdk"
import { createContext, useContext } from "react"

import { type AdminExtension, defineAdminExtension } from "../extensions.js"
import { useLocale } from "../providers/locale.js"
import { useTheme } from "../providers/theme.js"
import { ADMIN_UI_EXTENSION_SLOTS } from "./registry.js"
import { UiExtensionHost } from "./ui-extension-host.js"

/** Read-side dependency the factory uses to list an org's installed extensions. */
export interface UiExtensionsClient {
  list(): Promise<UiExtensionDescriptor[]>
}

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
  descriptors: ReadonlyArray<UiExtensionDescriptor>,
): UiExtensionsClient {
  const snapshot = [...descriptors]
  return { list: async () => snapshot }
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

  const context: UiExtensionContext = {
    org: environment.org,
    viewer: environment.viewer,
    entity: environment.entity ?? null,
    theme: resolvedTheme,
    locale: resolvedLocale,
  }

  return (
    <>
      {descriptors.map((descriptor) => (
        <UiExtensionHost
          key={descriptor.key}
          descriptor={descriptor}
          slot={slot}
          context={context}
          onNavigate={environment.onNavigate}
          onToast={environment.onToast}
        />
      ))}
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
