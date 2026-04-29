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
import { ExtrasUiMessagesProvider } from "../../../../extras-ui/src/index"

import { registryExtrasEn } from "./en"
import type { RegistryExtrasMessages } from "./messages"
import { registryExtrasRo } from "./ro"

const fallbackLocale = "en"

export const registryExtrasMessageDefinitions = {
  en: registryExtrasEn,
  ro: registryExtrasRo,
} satisfies LocaleMessageDefinitions<RegistryExtrasMessages>

export type RegistryExtrasMessageOverrides = LocaleMessageOverrides<RegistryExtrasMessages>

const registryExtrasContext =
  createPackageMessagesContext<RegistryExtrasMessages>("RegistryExtrasMessages")

const defaultRegistryExtrasI18n: PackageI18nValue<RegistryExtrasMessages> = {
  messages: registryExtrasEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryExtrasMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryExtrasMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryExtrasMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryExtrasMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryExtrasMessageOverrides | null
}) {
  return (
    <ExtrasUiMessagesProvider locale={locale}>
      <registryExtrasContext.ResolvedMessagesProvider
        definitions={registryExtrasMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryExtrasContext.ResolvedMessagesProvider>
    </ExtrasUiMessagesProvider>
  )
}

export const useRegistryExtrasI18n = registryExtrasContext.useI18n
export const useRegistryExtrasMessages = registryExtrasContext.useMessages

export function useRegistryExtrasI18nOrDefault() {
  return registryExtrasContext.useOptionalI18n() ?? defaultRegistryExtrasI18n
}

export function useRegistryExtrasMessagesOrDefault() {
  return useRegistryExtrasI18nOrDefault().messages
}
