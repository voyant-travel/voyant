"use client"

import { useEffect } from "react"

import { useLocale } from "./locale.js"

export interface AdminLocalePreferenceSource {
  locale?: string | null
  timeZone?: string | null
  timezone?: string | null
}

export interface AdminLocalePreferenceSyncProps {
  source: AdminLocalePreferenceSource | null | undefined
  localeStorageKey?: string | null
  timeZoneStorageKey?: string | null
}

export function AdminLocalePreferenceSync({ source }: AdminLocalePreferenceSyncProps) {
  const { locale, setLocale, setTimeZone, timeZone } = useLocale()
  const preferredTimeZone = source?.timeZone ?? source?.timezone ?? null

  useEffect(() => {
    if (!source || typeof window === "undefined") {
      return
    }

    if (source.locale && source.locale !== locale) {
      void setLocale(source.locale)
    }

    if (preferredTimeZone && preferredTimeZone !== timeZone) {
      void setTimeZone(preferredTimeZone)
    }
  }, [locale, preferredTimeZone, setLocale, setTimeZone, source, timeZone])

  return null
}
