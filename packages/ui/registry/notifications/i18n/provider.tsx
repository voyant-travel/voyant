"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

import { registryNotificationsEn } from "./en"
import type { RegistryNotificationsMessages } from "./messages"
import { registryNotificationsRo } from "./ro"

const fallbackLocale = "en"

export const registryNotificationsMessageDefinitions = {
  en: registryNotificationsEn,
  ro: registryNotificationsRo,
} satisfies LocaleMessageDefinitions<RegistryNotificationsMessages>

export type RegistryNotificationsMessageOverrides =
  LocaleMessageOverrides<RegistryNotificationsMessages>

const registryNotificationsContext = createPackageMessagesContext<RegistryNotificationsMessages>(
  "RegistryNotificationsMessages",
)

const defaultRegistryNotificationsI18n: PackageI18nValue<RegistryNotificationsMessages> = {
  messages: registryNotificationsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryNotificationsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryNotificationsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryNotificationsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryNotificationsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryNotificationsMessageOverrides | null
}) {
  return (
    <registryNotificationsContext.ResolvedMessagesProvider
      definitions={registryNotificationsMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </registryNotificationsContext.ResolvedMessagesProvider>
  )
}

export const useRegistryNotificationsI18n = registryNotificationsContext.useI18n
export const useRegistryNotificationsMessages = registryNotificationsContext.useMessages

export function useRegistryNotificationsI18nOrDefault() {
  return registryNotificationsContext.useOptionalI18n() ?? defaultRegistryNotificationsI18n
}

export function useRegistryNotificationsMessagesOrDefault() {
  return useRegistryNotificationsI18nOrDefault().messages
}
