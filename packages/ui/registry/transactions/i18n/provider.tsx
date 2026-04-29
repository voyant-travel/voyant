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

import { RegistryUiMessagesProvider } from "../../ui/i18n"

import { registryTransactionsEn } from "./en"
import type { RegistryTransactionsMessages } from "./messages"
import { registryTransactionsRo } from "./ro"

const fallbackLocale = "en"

export const registryTransactionsMessageDefinitions = {
  en: registryTransactionsEn,
  ro: registryTransactionsRo,
} satisfies LocaleMessageDefinitions<RegistryTransactionsMessages>

export type RegistryTransactionsMessageOverrides =
  LocaleMessageOverrides<RegistryTransactionsMessages>

const registryTransactionsContext = createPackageMessagesContext<RegistryTransactionsMessages>(
  "RegistryTransactionsMessages",
)

const defaultRegistryTransactionsI18n: PackageI18nValue<RegistryTransactionsMessages> = {
  messages: registryTransactionsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryTransactionsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryTransactionsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryTransactionsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryTransactionsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryTransactionsMessageOverrides | null
}) {
  return (
    <RegistryUiMessagesProvider locale={locale}>
      <registryTransactionsContext.ResolvedMessagesProvider
        definitions={registryTransactionsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryTransactionsContext.ResolvedMessagesProvider>
    </RegistryUiMessagesProvider>
  )
}

export const useRegistryTransactionsI18n = registryTransactionsContext.useI18n
export const useRegistryTransactionsMessages = registryTransactionsContext.useMessages

export function useRegistryTransactionsI18nOrDefault() {
  return registryTransactionsContext.useOptionalI18n() ?? defaultRegistryTransactionsI18n
}

export function useRegistryTransactionsMessagesOrDefault() {
  return useRegistryTransactionsI18nOrDefault().messages
}
