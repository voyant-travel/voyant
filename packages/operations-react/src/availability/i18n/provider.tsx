"use client"

import {
  adminAvailabilityMessages,
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyant-travel/i18n"
import type { ReactNode } from "react"

type BaseAvailabilityMessages = (typeof adminAvailabilityMessages.en)["availability"]

export type AvailabilityUiMessages = BaseAvailabilityMessages & {
  page: {
    loading: string
    loadFailed: string
    calendarTab: string
    filters: {
      statusLabel: string
      stateLabel: string
      dateRangeLabel: string
      anyDate: string
      allStatuses: string
      allStates: string
      active: string
      inactive: string
      reset: string
      productSearchEmpty: string
    }
    skeleton: {
      date: string
      product: string
      status: string
      remaining: string
      capacity: string
    }
  }
}

const availabilityUiExtraEn = {
  page: {
    loading: "Loading availability...",
    loadFailed: "Availability data could not be loaded.",
    calendarTab: "Calendar",
    filters: {
      statusLabel: "Status",
      stateLabel: "State",
      dateRangeLabel: "Date range",
      anyDate: "Any date",
      allStatuses: "All statuses",
      allStates: "All",
      active: "Active",
      inactive: "Inactive",
      reset: "Reset",
      productSearchEmpty: "No products match that search.",
    },
    skeleton: {
      date: "Date",
      product: "Product",
      status: "Status",
      remaining: "Remaining",
      capacity: "Capacity",
    },
  },
} satisfies Pick<AvailabilityUiMessages, "page">

const availabilityUiExtraRo = {
  page: {
    loading: "Se incarca disponibilitatea...",
    loadFailed: "Datele de disponibilitate nu au putut fi incarcate.",
    calendarTab: "Calendar",
    filters: {
      statusLabel: "Status",
      stateLabel: "Stare",
      dateRangeLabel: "Interval de date",
      anyDate: "Orice data",
      allStatuses: "Toate statusurile",
      allStates: "Toate",
      active: "Active",
      inactive: "Inactive",
      reset: "Reseteaza",
      productSearchEmpty: "Niciun produs nu se potriveste cautarii.",
    },
    skeleton: {
      date: "Data",
      product: "Produs",
      status: "Status",
      remaining: "Ramase",
      capacity: "Capacitate",
    },
  },
} satisfies Pick<AvailabilityUiMessages, "page">

export const availabilityUiEn = {
  ...adminAvailabilityMessages.en.availability,
  ...availabilityUiExtraEn,
} satisfies AvailabilityUiMessages

export const availabilityUiRo = {
  ...adminAvailabilityMessages.ro.availability,
  ...availabilityUiExtraRo,
} satisfies AvailabilityUiMessages

const fallbackLocale = "en"

export const availabilityUiMessageDefinitions = {
  en: availabilityUiEn,
  ro: availabilityUiRo,
} satisfies LocaleMessageDefinitions<AvailabilityUiMessages>

export type AvailabilityUiMessageOverrides = LocaleMessageOverrides<AvailabilityUiMessages>

const availabilityUiContext =
  createPackageMessagesContext<AvailabilityUiMessages>("AvailabilityUiMessages")

const defaultAvailabilityUiI18n: PackageI18nValue<AvailabilityUiMessages> = {
  messages: availabilityUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveAvailabilityUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: AvailabilityUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: availabilityUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getAvailabilityUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: AvailabilityUiMessageOverrides | null
}): PackageI18nValue<AvailabilityUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale

  return {
    messages: resolveAvailabilityUiMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function AvailabilityUiMessagesProvider({
  children,
  locale,
  timeZone,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  timeZone?: string | null
  overrides?: AvailabilityUiMessageOverrides | null
}) {
  return (
    <availabilityUiContext.ResolvedMessagesProvider
      definitions={availabilityUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      timeZone={timeZone}
      overrides={overrides}
    >
      {children}
    </availabilityUiContext.ResolvedMessagesProvider>
  )
}

export const useAvailabilityUiI18n = availabilityUiContext.useI18n
export const useAvailabilityUiMessages = availabilityUiContext.useMessages

export function useAvailabilityUiI18nOrDefault() {
  return availabilityUiContext.useOptionalI18n() ?? defaultAvailabilityUiI18n
}

export function useAvailabilityUiMessagesOrDefault() {
  return useAvailabilityUiI18nOrDefault().messages
}
