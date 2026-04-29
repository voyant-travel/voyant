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
import { ExternalRefsUiMessagesProvider } from "../../../../external-refs-ui/src/index"

import { registryExternalRefsEn } from "./en"
import type { RegistryExternalRefsMessages } from "./messages"
import { registryExternalRefsRo } from "./ro"

const fallbackLocale = "en"

export const registryExternalRefsMessageDefinitions = {
  en: registryExternalRefsEn,
  ro: registryExternalRefsRo,
} satisfies LocaleMessageDefinitions<RegistryExternalRefsMessages>

export type RegistryExternalRefsMessageOverrides =
  LocaleMessageOverrides<RegistryExternalRefsMessages>

const registryExternalRefsContext = createPackageMessagesContext<RegistryExternalRefsMessages>(
  "RegistryExternalRefsMessages",
)

const defaultRegistryExternalRefsI18n: PackageI18nValue<RegistryExternalRefsMessages> = {
  messages: registryExternalRefsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryExternalRefsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryExternalRefsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryExternalRefsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryExternalRefsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryExternalRefsMessageOverrides | null
}) {
  return (
    <ExternalRefsUiMessagesProvider locale={locale}>
      <registryExternalRefsContext.ResolvedMessagesProvider
        definitions={registryExternalRefsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryExternalRefsContext.ResolvedMessagesProvider>
    </ExternalRefsUiMessagesProvider>
  )
}

export const useRegistryExternalRefsI18n = registryExternalRefsContext.useI18n
export const useRegistryExternalRefsMessages = registryExternalRefsContext.useMessages

export function useRegistryExternalRefsI18nOrDefault() {
  return registryExternalRefsContext.useOptionalI18n() ?? defaultRegistryExternalRefsI18n
}

export function useRegistryExternalRefsMessagesOrDefault() {
  return useRegistryExternalRefsI18nOrDefault().messages
}
