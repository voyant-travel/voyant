"use client"

import { CruisesUiMessagesProvider } from "@voyantjs/cruises-ui"
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

import { registryCruisesEn } from "./en"
import type { RegistryCruisesMessages } from "./messages"
import { registryCruisesRo } from "./ro"

const fallbackLocale = "en"

export const registryCruisesMessageDefinitions = {
  en: registryCruisesEn,
  ro: registryCruisesRo,
} satisfies LocaleMessageDefinitions<RegistryCruisesMessages>

export type RegistryCruisesMessageOverrides = LocaleMessageOverrides<RegistryCruisesMessages>

const registryCruisesContext =
  createPackageMessagesContext<RegistryCruisesMessages>("RegistryCruisesMessages")

const defaultRegistryCruisesI18n: PackageI18nValue<RegistryCruisesMessages> = {
  messages: registryCruisesEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryCruisesMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryCruisesMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryCruisesMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getRegistryCruisesI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: RegistryCruisesMessageOverrides | null
}): PackageI18nValue<RegistryCruisesMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveRegistryCruisesMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function RegistryCruisesMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryCruisesMessageOverrides | null
}) {
  return (
    <CruisesUiMessagesProvider locale={locale}>
      <registryCruisesContext.ResolvedMessagesProvider
        definitions={registryCruisesMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryCruisesContext.ResolvedMessagesProvider>
    </CruisesUiMessagesProvider>
  )
}

export const useRegistryCruisesI18n = registryCruisesContext.useI18n
export const useRegistryCruisesMessages = registryCruisesContext.useMessages

export function useRegistryCruisesI18nOrDefault() {
  return registryCruisesContext.useOptionalI18n() ?? defaultRegistryCruisesI18n
}

export function useRegistryCruisesMessagesOrDefault() {
  return useRegistryCruisesI18nOrDefault().messages
}

export { formatMessage }
