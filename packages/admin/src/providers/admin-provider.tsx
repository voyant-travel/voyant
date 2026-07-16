"use client"

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"

import type { ThemeMode } from "../types.js"
import { LocaleProvider, type LocaleProviderProps } from "./locale.js"
import { makeQueryClient } from "./query-client.js"
import { ThemeProvider } from "./theme.js"

export interface AdminProviderProps {
  children: ReactNode
  /**
   * Pre-built QueryClient. If not provided, one is created per render-tree
   * via `makeQueryClient()`. Pass your own for server-rendering setups where
   * the client should be created outside React.
   */
  queryClient?: QueryClient
  /** Initial theme. Defaults to "system". */
  defaultTheme?: ThemeMode
  /**
   * localStorage key for theme persistence. Pass `null` to disable.
   * Defaults to `"theme"`.
   */
  themeStorageKey?: string | null
  /** Initial locale. Defaults to browser locale with `en` fallback. */
  defaultLocale?: string
  /** Initial timezone. Defaults to browser timezone. */
  defaultTimeZone?: string | null
  /**
   * localStorage key for locale persistence. Pass `null` to disable.
   * Defaults to `"admin-locale"`.
   */
  localeStorageKey?: string | null
  /**
   * localStorage key for timezone persistence. Pass `null` to disable.
   * Defaults to `"admin-timezone"`.
   */
  timeZoneStorageKey?: string | null
  /** Supported admin locales. Defaults to `["en", "ro"]`. */
  supportedLocales?: readonly string[]
  /** Fallback locale when no supported locale is resolved. Defaults to `"en"`. */
  fallbackLocale?: string
  preferenceAuthority?: "device" | "account"
  onPreferenceChange?: LocaleProviderProps["onPreferenceChange"]
}

/**
 * Composes the shared admin providers — QueryClient, Theme, and Locale — so
 * starters don't have to wire each one individually. Note: this does NOT include
 * `<VoyantReactProvider>` (from `@voyant-travel/react`) because its API base
 * URL is starter-specific. Wrap AdminProvider's children with your
 * VoyantReactProvider at the same level.
 *
 * @example
 * <AdminProvider>
 *   <VoyantReactProvider baseUrl="/api">
 *     <App />
 *   </VoyantReactProvider>
 * </AdminProvider>
 */
export function AdminProvider({
  children,
  queryClient,
  defaultTheme = "system",
  themeStorageKey = "theme",
  defaultLocale,
  defaultTimeZone,
  localeStorageKey = "admin-locale",
  timeZoneStorageKey = "admin-timezone",
  supportedLocales,
  fallbackLocale,
  preferenceAuthority,
  onPreferenceChange,
}: AdminProviderProps) {
  // Keep a single QueryClient instance per mount when one isn't passed in.
  const [client] = useState(() => queryClient ?? makeQueryClient())

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme={defaultTheme} storageKey={themeStorageKey}>
        <LocaleProvider
          defaultLocale={defaultLocale}
          defaultTimeZone={defaultTimeZone}
          localeStorageKey={localeStorageKey}
          timeZoneStorageKey={timeZoneStorageKey}
          supportedLocales={supportedLocales}
          fallbackLocale={fallbackLocale}
          preferenceAuthority={preferenceAuthority}
          onPreferenceChange={onPreferenceChange}
        >
          {children}
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
