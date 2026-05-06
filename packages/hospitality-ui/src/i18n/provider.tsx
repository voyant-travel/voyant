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

import { hospitalityUiEn } from "./en.js"
import type { HospitalityUiMessages } from "./messages.js"
import { hospitalityUiRo } from "./ro.js"

const fallbackLocale = "en"

export const hospitalityUiMessageDefinitions = {
  en: hospitalityUiEn,
  ro: hospitalityUiRo,
} satisfies LocaleMessageDefinitions<HospitalityUiMessages>

export type HospitalityUiMessageOverrides = LocaleMessageOverrides<HospitalityUiMessages>

const hospitalityUiContext =
  createPackageMessagesContext<HospitalityUiMessages>("HospitalityUiMessages")

const defaultHospitalityUiI18n: PackageI18nValue<HospitalityUiMessages> = {
  messages: hospitalityUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveHospitalityUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: HospitalityUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: hospitalityUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getHospitalityUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: HospitalityUiMessageOverrides | null
}): PackageI18nValue<HospitalityUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveHospitalityUiMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function HospitalityUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: HospitalityUiMessageOverrides | null
}) {
  return (
    <hospitalityUiContext.ResolvedMessagesProvider
      definitions={hospitalityUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </hospitalityUiContext.ResolvedMessagesProvider>
  )
}

export const useHospitalityUiI18n = hospitalityUiContext.useI18n
export const useHospitalityUiMessages = hospitalityUiContext.useMessages

export function useHospitalityUiI18nOrDefault() {
  return hospitalityUiContext.useOptionalI18n() ?? defaultHospitalityUiI18n
}

export function useHospitalityUiMessagesOrDefault() {
  return useHospitalityUiI18nOrDefault().messages
}
