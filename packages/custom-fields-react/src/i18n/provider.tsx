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

import { customFieldsUiEn } from "./en.js"
import type { CustomFieldsUiMessages } from "./messages.js"
import { customFieldsUiRo } from "./ro.js"

const fallbackLocale = "en"

export const customFieldsUiMessageDefinitions = {
  en: customFieldsUiEn,
  ro: customFieldsUiRo,
} satisfies LocaleMessageDefinitions<CustomFieldsUiMessages>

export type CustomFieldsUiMessageOverrides = LocaleMessageOverrides<CustomFieldsUiMessages>

const customFieldsUiContext =
  createPackageMessagesContext<CustomFieldsUiMessages>("CustomFieldsUiMessages")

const defaultCustomFieldsUiI18n: PackageI18nValue<CustomFieldsUiMessages> = {
  messages: customFieldsUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveCustomFieldsUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: CustomFieldsUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: customFieldsUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getCustomFieldsUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: CustomFieldsUiMessageOverrides | null
}): PackageI18nValue<CustomFieldsUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale

  return {
    messages: resolveCustomFieldsUiMessages({ locale: resolvedLocale, overrides }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function CustomFieldsUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: CustomFieldsUiMessageOverrides | null
}) {
  return (
    <customFieldsUiContext.ResolvedMessagesProvider
      definitions={customFieldsUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </customFieldsUiContext.ResolvedMessagesProvider>
  )
}

export const useCustomFieldsUiI18n = customFieldsUiContext.useI18n
export const useCustomFieldsUiMessages = customFieldsUiContext.useMessages

export function useCustomFieldsUiI18nOrDefault() {
  return customFieldsUiContext.useOptionalI18n() ?? defaultCustomFieldsUiI18n
}

export function useCustomFieldsUiMessagesOrDefault() {
  return useCustomFieldsUiI18nOrDefault().messages
}
