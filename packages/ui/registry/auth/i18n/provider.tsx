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

import { registryAuthEn } from "./en"
import type { RegistryAuthMessages } from "./messages"
import { registryAuthRo } from "./ro"

const fallbackLocale = "en"

export const registryAuthMessageDefinitions = {
  en: registryAuthEn,
  ro: registryAuthRo,
} satisfies LocaleMessageDefinitions<RegistryAuthMessages>

export type RegistryAuthMessageOverrides = LocaleMessageOverrides<RegistryAuthMessages>

const registryAuthContext = createPackageMessagesContext<RegistryAuthMessages>("RegistryAuth")

const defaultRegistryAuthI18n: PackageI18nValue<RegistryAuthMessages> = {
  messages: registryAuthEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryAuthMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryAuthMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryAuthMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryAuthMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryAuthMessageOverrides | null
}) {
  return (
    <registryAuthContext.ResolvedMessagesProvider
      definitions={registryAuthMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </registryAuthContext.ResolvedMessagesProvider>
  )
}

export const useRegistryAuthI18n = registryAuthContext.useI18n
export const useRegistryAuthMessages = registryAuthContext.useMessages

export function useRegistryAuthI18nOrDefault() {
  return registryAuthContext.useOptionalI18n() ?? defaultRegistryAuthI18n
}

export function useRegistryAuthMessagesOrDefault() {
  return useRegistryAuthI18nOrDefault().messages
}
