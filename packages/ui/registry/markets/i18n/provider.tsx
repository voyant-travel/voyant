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

import { MarketsUiMessagesProvider } from "../../../../markets-ui/src/index"

import { registryMarketsEn } from "./en"
import type { RegistryMarketsMessages } from "./messages"
import { registryMarketsRo } from "./ro"

const fallbackLocale = "en"

export const registryMarketsMessageDefinitions = {
  en: registryMarketsEn,
  ro: registryMarketsRo,
} satisfies LocaleMessageDefinitions<RegistryMarketsMessages>

export type RegistryMarketsMessageOverrides = LocaleMessageOverrides<RegistryMarketsMessages>

const registryMarketsContext =
  createPackageMessagesContext<RegistryMarketsMessages>("RegistryMarketsMessages")

const defaultRegistryMarketsI18n: PackageI18nValue<RegistryMarketsMessages> = {
  messages: registryMarketsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryMarketsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryMarketsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryMarketsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryMarketsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryMarketsMessageOverrides | null
}) {
  return (
    <MarketsUiMessagesProvider locale={locale}>
      <registryMarketsContext.ResolvedMessagesProvider
        definitions={registryMarketsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryMarketsContext.ResolvedMessagesProvider>
    </MarketsUiMessagesProvider>
  )
}

export const useRegistryMarketsI18n = registryMarketsContext.useI18n
export const useRegistryMarketsMessages = registryMarketsContext.useMessages

export function useRegistryMarketsI18nOrDefault() {
  return registryMarketsContext.useOptionalI18n() ?? defaultRegistryMarketsI18n
}

export function useRegistryMarketsMessagesOrDefault() {
  return useRegistryMarketsI18nOrDefault().messages
}
