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

import { SellabilityUiMessagesProvider } from "../../../../sellability-ui/src/index"

import { registrySellabilityEn } from "./en"
import type { RegistrySellabilityMessages } from "./messages"
import { registrySellabilityRo } from "./ro"

const fallbackLocale = "en"

export const registrySellabilityMessageDefinitions = {
  en: registrySellabilityEn,
  ro: registrySellabilityRo,
} satisfies LocaleMessageDefinitions<RegistrySellabilityMessages>

export type RegistrySellabilityMessageOverrides =
  LocaleMessageOverrides<RegistrySellabilityMessages>

const registrySellabilityContext = createPackageMessagesContext<RegistrySellabilityMessages>(
  "RegistrySellabilityMessages",
)

const defaultRegistrySellabilityI18n: PackageI18nValue<RegistrySellabilityMessages> = {
  messages: registrySellabilityEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistrySellabilityMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistrySellabilityMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registrySellabilityMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistrySellabilityMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistrySellabilityMessageOverrides | null
}) {
  return (
    <SellabilityUiMessagesProvider locale={locale}>
      <registrySellabilityContext.ResolvedMessagesProvider
        definitions={registrySellabilityMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registrySellabilityContext.ResolvedMessagesProvider>
    </SellabilityUiMessagesProvider>
  )
}

export const useRegistrySellabilityI18n = registrySellabilityContext.useI18n
export const useRegistrySellabilityMessages = registrySellabilityContext.useMessages

export function useRegistrySellabilityI18nOrDefault() {
  return registrySellabilityContext.useOptionalI18n() ?? defaultRegistrySellabilityI18n
}

export function useRegistrySellabilityMessagesOrDefault() {
  return useRegistrySellabilityI18nOrDefault().messages
}
