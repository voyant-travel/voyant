"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyant-travel/i18n"
import type { ReactNode } from "react"

import { appsUiEn } from "./en.js"
import type { AppsUiMessages } from "./messages.js"
import { appsUiRo } from "./ro.js"

const fallbackLocale = "en"

export const appsUiMessageDefinitions = {
  en: appsUiEn,
  ro: appsUiRo,
} satisfies LocaleMessageDefinitions<AppsUiMessages>

export type AppsUiMessageOverrides = LocaleMessageOverrides<AppsUiMessages>

const appsUiContext = createPackageMessagesContext<AppsUiMessages>("AppsUiMessages")

const defaultAppsUiI18n: PackageI18nValue<AppsUiMessages> = {
  messages: appsUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveAppsUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: AppsUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: appsUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getAppsUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: AppsUiMessageOverrides | null
}): PackageI18nValue<AppsUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale

  return {
    messages: resolveAppsUiMessages({ locale: resolvedLocale, overrides }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function AppsUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: AppsUiMessageOverrides | null
}) {
  return (
    <appsUiContext.ResolvedMessagesProvider
      definitions={appsUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </appsUiContext.ResolvedMessagesProvider>
  )
}

export const useAppsUiI18n = appsUiContext.useI18n
export const useAppsUiMessages = appsUiContext.useMessages

export function useAppsUiI18nOrDefault() {
  return appsUiContext.useOptionalI18n() ?? defaultAppsUiI18n
}

export function useAppsUiMessagesOrDefault() {
  return useAppsUiI18nOrDefault().messages
}
