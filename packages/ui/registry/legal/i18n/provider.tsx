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

import { LegalUiMessagesProvider } from "../../../../legal-ui/src/index"
import { registryLegalEn } from "./en"
import type { RegistryLegalMessages } from "./messages"
import { registryLegalRo } from "./ro"

const fallbackLocale = "en"

export const registryLegalMessageDefinitions = {
  en: registryLegalEn,
  ro: registryLegalRo,
} satisfies LocaleMessageDefinitions<RegistryLegalMessages>

export type RegistryLegalMessageOverrides = LocaleMessageOverrides<RegistryLegalMessages>

const registryLegalContext =
  createPackageMessagesContext<RegistryLegalMessages>("RegistryLegalMessages")

const defaultRegistryLegalI18n: PackageI18nValue<RegistryLegalMessages> = {
  messages: registryLegalEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryLegalMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryLegalMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryLegalMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryLegalMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryLegalMessageOverrides | null
}) {
  return (
    <LegalUiMessagesProvider locale={locale}>
      <registryLegalContext.ResolvedMessagesProvider
        definitions={registryLegalMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryLegalContext.ResolvedMessagesProvider>
    </LegalUiMessagesProvider>
  )
}

export const useRegistryLegalI18n = registryLegalContext.useI18n
export const useRegistryLegalMessages = registryLegalContext.useMessages

export function useRegistryLegalI18nOrDefault() {
  return registryLegalContext.useOptionalI18n() ?? defaultRegistryLegalI18n
}

export function useRegistryLegalMessagesOrDefault() {
  return useRegistryLegalI18nOrDefault().messages
}
