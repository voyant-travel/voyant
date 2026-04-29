"use client"

import { ChartersUiMessagesProvider } from "@voyantjs/charters-ui"
import {
  createLocaleFormatters,
  createPackageMessagesContext,
  formatMessage,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

import { registryChartersEn } from "./en"
import type { RegistryChartersMessages } from "./messages"
import { registryChartersRo } from "./ro"

const fallbackLocale = "en"

export const registryChartersMessageDefinitions = {
  en: registryChartersEn,
  ro: registryChartersRo,
} satisfies LocaleMessageDefinitions<RegistryChartersMessages>

export type RegistryChartersMessageOverrides = LocaleMessageOverrides<RegistryChartersMessages>

const registryChartersContext = createPackageMessagesContext<RegistryChartersMessages>(
  "RegistryChartersMessages",
)

const defaultRegistryChartersI18n: PackageI18nValue<RegistryChartersMessages> = {
  messages: registryChartersEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryChartersMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryChartersMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryChartersMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getRegistryChartersI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: RegistryChartersMessageOverrides | null
}): PackageI18nValue<RegistryChartersMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveRegistryChartersMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function RegistryChartersMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryChartersMessageOverrides | null
}) {
  return (
    <ChartersUiMessagesProvider locale={locale}>
      <registryChartersContext.ResolvedMessagesProvider
        definitions={registryChartersMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryChartersContext.ResolvedMessagesProvider>
    </ChartersUiMessagesProvider>
  )
}

export const useRegistryChartersI18n = registryChartersContext.useI18n
export const useRegistryChartersMessages = registryChartersContext.useMessages

export function useRegistryChartersI18nOrDefault() {
  return registryChartersContext.useOptionalI18n() ?? defaultRegistryChartersI18n
}

export function useRegistryChartersMessagesOrDefault() {
  return useRegistryChartersI18nOrDefault().messages
}

export { formatMessage }
