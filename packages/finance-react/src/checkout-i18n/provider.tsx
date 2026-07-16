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

import { checkoutUiEn } from "./en.js"
import type { CheckoutUiMessages } from "./messages.js"
import { checkoutUiRo } from "./ro.js"

const fallbackLocale = "en"

export const checkoutUiMessageDefinitions = {
  en: checkoutUiEn,
  ro: checkoutUiRo,
} satisfies LocaleMessageDefinitions<CheckoutUiMessages>

export type CheckoutUiMessageOverrides = LocaleMessageOverrides<CheckoutUiMessages>

const checkoutUiContext = createPackageMessagesContext<CheckoutUiMessages>("CheckoutUiMessages")

const defaultCheckoutUiI18n: PackageI18nValue<CheckoutUiMessages> = {
  messages: checkoutUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveCheckoutUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: CheckoutUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: checkoutUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getCheckoutUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: CheckoutUiMessageOverrides | null
}): PackageI18nValue<CheckoutUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveCheckoutUiMessages({ locale: resolvedLocale, overrides }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function CheckoutUiMessagesProvider({
  children,
  locale,
  timeZone,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  timeZone?: string | null
  overrides?: CheckoutUiMessageOverrides | null
}) {
  return (
    <checkoutUiContext.ResolvedMessagesProvider
      definitions={checkoutUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      timeZone={timeZone}
      overrides={overrides}
    >
      {children}
    </checkoutUiContext.ResolvedMessagesProvider>
  )
}

export const useCheckoutUiI18n = checkoutUiContext.useI18n
export const useCheckoutUiMessages = checkoutUiContext.useMessages

export function useCheckoutUiI18nOrDefault() {
  return checkoutUiContext.useOptionalI18n() ?? defaultCheckoutUiI18n
}

export function useCheckoutUiMessagesOrDefault() {
  return useCheckoutUiI18nOrDefault().messages
}
