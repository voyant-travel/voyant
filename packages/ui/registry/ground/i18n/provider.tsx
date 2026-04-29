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

import { registryGroundEn } from "./en"
import type { RegistryGroundMessages } from "./messages"
import { registryGroundRo } from "./ro"

const fallbackLocale = "en"

export const registryGroundMessageDefinitions = {
  en: registryGroundEn,
  ro: registryGroundRo,
} satisfies LocaleMessageDefinitions<RegistryGroundMessages>

export type RegistryGroundMessageOverrides = LocaleMessageOverrides<RegistryGroundMessages>

const registryGroundContext = createPackageMessagesContext<RegistryGroundMessages>("RegistryGround")

const defaultRegistryGroundI18n: PackageI18nValue<RegistryGroundMessages> = {
  messages: registryGroundEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryGroundMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryGroundMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryGroundMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryGroundMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryGroundMessageOverrides | null
}) {
  return (
    <registryGroundContext.ResolvedMessagesProvider
      definitions={registryGroundMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </registryGroundContext.ResolvedMessagesProvider>
  )
}

export const useRegistryGroundI18n = registryGroundContext.useI18n
export const useRegistryGroundMessages = registryGroundContext.useMessages

export function useRegistryGroundI18nOrDefault() {
  return registryGroundContext.useOptionalI18n() ?? defaultRegistryGroundI18n
}

export function useRegistryGroundMessagesOrDefault() {
  return useRegistryGroundI18nOrDefault().messages
}
