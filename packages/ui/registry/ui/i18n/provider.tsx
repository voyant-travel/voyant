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

import { registryUiEn } from "./en"
import type { RegistryUiMessages } from "./messages"
import { registryUiRo } from "./ro"

const fallbackLocale = "en"

export const registryUiMessageDefinitions = {
  en: registryUiEn,
  ro: registryUiRo,
} satisfies LocaleMessageDefinitions<RegistryUiMessages>

export type RegistryUiMessageOverrides = LocaleMessageOverrides<RegistryUiMessages>

const registryUiContext = createPackageMessagesContext<RegistryUiMessages>("RegistryUi")

const defaultRegistryUiI18n: PackageI18nValue<RegistryUiMessages> = {
  messages: registryUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryUiMessageOverrides | null
}) {
  return (
    <registryUiContext.ResolvedMessagesProvider
      definitions={registryUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </registryUiContext.ResolvedMessagesProvider>
  )
}

export const useRegistryUiI18n = registryUiContext.useI18n
export const useRegistryUiMessages = registryUiContext.useMessages

export function useRegistryUiI18nOrDefault() {
  return registryUiContext.useOptionalI18n() ?? defaultRegistryUiI18n
}

export function useRegistryUiMessagesOrDefault() {
  return useRegistryUiI18nOrDefault().messages
}
