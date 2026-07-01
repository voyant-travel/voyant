"use client"

import type { StorefrontMarketRecord } from "@voyant-travel/storefront-react"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"

/**
 * Customer-facing storefront scope (voyant#2643).
 *
 * Holds the anonymous shopper's selected market / locale / currency and
 * persists it in `localStorage` so the choice survives reloads and navigation.
 * The scope is app-owned (like `storefront-i18n`) because persistence key and
 * defaults are deployment concerns; the market *data* comes from the packaged
 * `useStorefrontMarkets` hook.
 *
 * `marketId` is the catalog-search scope key — the shop page threads it into
 * `useCatalogSearch({ market })` and detail pages into `useBookingQuote({
 * scope })`. When nothing is selected the fields are `undefined` and the
 * backend's default scope applies, so the default experience is unchanged.
 */

export interface StorefrontScope {
  marketId?: string
  locale?: string
  currency?: string
}

interface StorefrontScopeContextValue extends StorefrontScope {
  /** Select a market and reset locale/currency to that market's defaults. */
  selectMarket: (market: StorefrontMarketRecord) => void
  setLocale: (locale: string) => void
  setCurrency: (currency: string) => void
}

const STORAGE_KEY = "voyant.storefront.scope"

const StorefrontScopeContext = createContext<StorefrontScopeContextValue | null>(null)

function readPersistedScope(): StorefrontScope {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      marketId: typeof parsed.marketId === "string" ? parsed.marketId : undefined,
      locale: typeof parsed.locale === "string" ? parsed.locale : undefined,
      currency: typeof parsed.currency === "string" ? parsed.currency : undefined,
    }
  } catch {
    return {}
  }
}

function persistScope(scope: StorefrontScope): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope))
  } catch {
    // Ignore quota / disabled-storage errors — scope simply won't persist.
  }
}

export function StorefrontScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<StorefrontScope>(readPersistedScope)

  const update = useCallback((next: StorefrontScope) => {
    setScope(next)
    persistScope(next)
  }, [])

  const value = useMemo<StorefrontScopeContextValue>(
    () => ({
      ...scope,
      selectMarket: (market) =>
        update({
          marketId: market.id,
          locale: market.defaultLocale,
          currency: market.defaultCurrency,
        }),
      setLocale: (locale) => update({ ...scope, locale }),
      setCurrency: (currency) => update({ ...scope, currency }),
    }),
    [scope, update],
  )

  return <StorefrontScopeContext.Provider value={value}>{children}</StorefrontScopeContext.Provider>
}

export function useStorefrontScope(): StorefrontScopeContextValue {
  const ctx = useContext(StorefrontScopeContext)
  if (!ctx) {
    throw new Error("useStorefrontScope must be used within a StorefrontScopeProvider")
  }
  return ctx
}
