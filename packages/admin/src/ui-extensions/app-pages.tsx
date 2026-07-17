"use client"

/**
 * Full-page app extensions (RFC §6): an app declares admin pages under an
 * app-owned admin route plus navigation contributions. Pages render through the
 * same sandboxed host as slot extensions — no `allow-same-origin`, unchanged
 * sandbox posture — but fill the available height instead of following the
 * frame's self-reported resize height.
 */
import { useQuery } from "@tanstack/react-query"
import {
  ADMIN_UI_EXTENSION_API_VERSION,
  type UiExtensionContext,
  type UiExtensionDescriptor,
} from "@voyant-travel/admin-extension-sdk"

import { useLocale } from "../providers/locale.js"
import { useTheme } from "../providers/theme.js"
import { UiExtensionHost } from "./ui-extension-host.js"
import {
  type AppPageDescriptor,
  type UiExtensionEnvironment,
  type UiExtensionsClient,
  useUiExtensionEnvironment,
} from "./ui-extensions-extension.js"

/** Query key for the installed full-page app extensions. */
export const APP_PAGES_QUERY_KEY = ["voyant", "admin", "app-pages"] as const

let warnedPageListError = false

function useInstalledAppPagesQuery(client: UiExtensionsClient) {
  return useQuery({
    queryKey: APP_PAGES_QUERY_KEY,
    queryFn: async () => (client.listPages ? client.listPages() : []),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/** Read the installed app pages (fail-soft: list errors resolve to none). */
export function useInstalledAppPages(client: UiExtensionsClient): AppPageDescriptor[] {
  const query = useInstalledAppPagesQuery(client)
  if (query.isError) {
    if (!warnedPageListError) {
      warnedPageListError = true
      console.warn("[voyant-admin] Failed to list app pages; rendering none.", query.error)
    }
    return []
  }
  return query.data ?? []
}

/** A navigation entry contributed by an installed app page. */
export interface AppPageNavEntry {
  key: string
  /** Route path relative to the app-owned admin route segment. */
  path: string
  label: string
}

/**
 * Navigation contributions for installed app pages. The admin shell renders
 * these as nav entries pointing at the app-owned admin route.
 */
export function useAppPageNavEntries(client: UiExtensionsClient): AppPageNavEntry[] {
  return useInstalledAppPages(client).map((page) => ({
    key: page.key,
    path: page.path,
    label: page.navLabel,
  }))
}

/** Adapt a page descriptor into the SDK descriptor shape the host renders. */
function toPageHostDescriptor(page: AppPageDescriptor): UiExtensionDescriptor {
  return {
    key: page.key,
    version: "1.0.0",
    displayName: page.title,
    // Pages use the same protocol as the host implements; they are release-pinned
    // by the installation rather than gated on a manifest-declared range.
    extensionApi: ADMIN_UI_EXTENSION_API_VERSION,
    entryUrl: page.entryUrl,
    slots: [],
  }
}

export interface AppExtensionPageProps {
  page: AppPageDescriptor
  /** Ambient environment; defaults to the nearest provider. */
  environment?: UiExtensionEnvironment
  className?: string
}

/**
 * Render one full-page app extension. Reads org/viewer/token-broker from the
 * environment and passes the page's resolved app locale/direction to the frame.
 * Fails soft through the same error-card path as slot extensions.
 */
export function AppExtensionPage({ page, environment, className }: AppExtensionPageProps) {
  const ambient = useUiExtensionEnvironment()
  const env = environment ?? ambient
  const { resolvedTheme } = useTheme()
  const { resolvedLocale } = useLocale()

  if (!env) return null

  const context: UiExtensionContext = {
    org: env.org,
    viewer: env.viewer,
    entity: null,
    theme: resolvedTheme,
    locale: resolvedLocale,
    appLocale: page.appLocale ?? resolvedLocale,
    direction: page.direction ?? "ltr",
  }
  const broker = env.requestToken

  return (
    <UiExtensionHost
      descriptor={toPageHostDescriptor(page)}
      slot={`page:${page.path}`}
      context={context}
      fill
      className={className}
      onNavigate={env.onNavigate}
      onToast={env.onToast}
      onRequestToken={
        broker
          ? () =>
              broker({
                descriptor: { ...toPageHostDescriptor(page), installationId: page.installationId },
                slot: `page:${page.path}`,
                entity: null,
              })
          : undefined
      }
    />
  )
}
