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

import { CrmUiMessagesProvider } from "../../../../crm-ui/src/index"
import { registryCrmEn } from "./en"
import type { RegistryCrmMessages } from "./messages"
import { registryCrmRo } from "./ro"

const fallbackLocale = "en"

export const registryCrmMessageDefinitions = {
  en: registryCrmEn,
  ro: registryCrmRo,
} satisfies LocaleMessageDefinitions<RegistryCrmMessages>

export type RegistryCrmMessageOverrides = LocaleMessageOverrides<RegistryCrmMessages>

const registryCrmContext = createPackageMessagesContext<RegistryCrmMessages>("RegistryCrmMessages")

const defaultRegistryCrmI18n: PackageI18nValue<RegistryCrmMessages> = {
  messages: registryCrmEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryCrmMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryCrmMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryCrmMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryCrmMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryCrmMessageOverrides | null
}) {
  return (
    <CrmUiMessagesProvider locale={locale}>
      <registryCrmContext.ResolvedMessagesProvider
        definitions={registryCrmMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryCrmContext.ResolvedMessagesProvider>
    </CrmUiMessagesProvider>
  )
}

export const useRegistryCrmI18n = registryCrmContext.useI18n
export const useRegistryCrmMessages = registryCrmContext.useMessages

export function useRegistryCrmI18nOrDefault() {
  return registryCrmContext.useOptionalI18n() ?? defaultRegistryCrmI18n
}

export function useRegistryCrmMessagesOrDefault() {
  return useRegistryCrmI18nOrDefault().messages
}
