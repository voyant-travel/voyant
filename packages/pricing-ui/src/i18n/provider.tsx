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

import { pricingUiEn } from "./en"
import type { PricingUiMessages } from "./messages"
import { pricingUiRo } from "./ro"

const fallbackLocale = "en"

export const pricingUiMessageDefinitions = {
  en: pricingUiEn,
  ro: pricingUiRo,
} satisfies LocaleMessageDefinitions<PricingUiMessages>

export type PricingUiMessageOverrides = LocaleMessageOverrides<PricingUiMessages>

const pricingUiContext = createPackageMessagesContext<PricingUiMessages>("PricingUiMessages")

const defaultPricingUiI18n: PackageI18nValue<PricingUiMessages> = {
  messages: pricingUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolvePricingUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: PricingUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: pricingUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getPricingUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: PricingUiMessageOverrides | null
}): PackageI18nValue<PricingUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolvePricingUiMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function PricingUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: PricingUiMessageOverrides | null
}) {
  return (
    <pricingUiContext.ResolvedMessagesProvider
      definitions={pricingUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </pricingUiContext.ResolvedMessagesProvider>
  )
}

export const usePricingUiI18n = pricingUiContext.useI18n
export const usePricingUiMessages = pricingUiContext.useMessages

export function usePricingUiI18nOrDefault() {
  return pricingUiContext.useOptionalI18n() ?? defaultPricingUiI18n
}

export function usePricingUiMessagesOrDefault() {
  return usePricingUiI18nOrDefault().messages
}
