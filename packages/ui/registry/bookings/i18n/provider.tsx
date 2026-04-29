"use client"

import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui"
import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

import { registryBookingsEn } from "./en"
import type { RegistryBookingsMessages } from "./messages"
import { registryBookingsRo } from "./ro"

const fallbackLocale = "en"

export const registryBookingsMessageDefinitions = {
  en: registryBookingsEn,
  ro: registryBookingsRo,
} satisfies LocaleMessageDefinitions<RegistryBookingsMessages>

export type RegistryBookingsMessageOverrides = LocaleMessageOverrides<RegistryBookingsMessages>

const registryBookingsContext = createPackageMessagesContext<RegistryBookingsMessages>(
  "RegistryBookingsMessages",
)

const defaultRegistryBookingsI18n: PackageI18nValue<RegistryBookingsMessages> = {
  messages: registryBookingsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryBookingsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryBookingsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryBookingsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getRegistryBookingsI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: RegistryBookingsMessageOverrides | null
}): PackageI18nValue<RegistryBookingsMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveRegistryBookingsMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function RegistryBookingsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryBookingsMessageOverrides | null
}) {
  return (
    <BookingsUiMessagesProvider locale={locale}>
      <registryBookingsContext.ResolvedMessagesProvider
        definitions={registryBookingsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryBookingsContext.ResolvedMessagesProvider>
    </BookingsUiMessagesProvider>
  )
}

export const useRegistryBookingsI18n = registryBookingsContext.useI18n
export const useRegistryBookingsMessages = registryBookingsContext.useMessages

export function useRegistryBookingsI18nOrDefault() {
  return registryBookingsContext.useOptionalI18n() ?? defaultRegistryBookingsI18n
}

export function useRegistryBookingsMessagesOrDefault() {
  return useRegistryBookingsI18nOrDefault().messages
}
