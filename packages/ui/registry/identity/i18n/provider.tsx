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

import { IdentityUiMessagesProvider } from "../../../../identity-ui/src/index"

import { registryIdentityEn } from "./en"
import type { RegistryIdentityMessages } from "./messages"
import { registryIdentityRo } from "./ro"

const fallbackLocale = "en"

export const registryIdentityMessageDefinitions = {
  en: registryIdentityEn,
  ro: registryIdentityRo,
} satisfies LocaleMessageDefinitions<RegistryIdentityMessages>

export type RegistryIdentityMessageOverrides = LocaleMessageOverrides<RegistryIdentityMessages>

const registryIdentityContext = createPackageMessagesContext<RegistryIdentityMessages>(
  "RegistryIdentityMessages",
)

const defaultRegistryIdentityI18n: PackageI18nValue<RegistryIdentityMessages> = {
  messages: registryIdentityEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryIdentityMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryIdentityMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryIdentityMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryIdentityMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryIdentityMessageOverrides | null
}) {
  return (
    <IdentityUiMessagesProvider locale={locale}>
      <registryIdentityContext.ResolvedMessagesProvider
        definitions={registryIdentityMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryIdentityContext.ResolvedMessagesProvider>
    </IdentityUiMessagesProvider>
  )
}

export const useRegistryIdentityI18n = registryIdentityContext.useI18n
export const useRegistryIdentityMessages = registryIdentityContext.useMessages

export function useRegistryIdentityI18nOrDefault() {
  return registryIdentityContext.useOptionalI18n() ?? defaultRegistryIdentityI18n
}

export function useRegistryIdentityMessagesOrDefault() {
  return useRegistryIdentityI18nOrDefault().messages
}
