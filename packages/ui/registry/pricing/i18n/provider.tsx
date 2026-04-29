"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import { PricingUiMessagesProvider } from "@voyantjs/pricing-ui"
import type { ReactNode } from "react"

import { registryPricingEn } from "./en"
import type { RegistryPricingMessages } from "./messages"
import { registryPricingRo } from "./ro"

const fallbackLocale = "en"

export const registryPricingMessageDefinitions = {
  en: registryPricingEn,
  ro: registryPricingRo,
} satisfies LocaleMessageDefinitions<RegistryPricingMessages>

export type RegistryPricingMessageOverrides = LocaleMessageOverrides<RegistryPricingMessages>

const registryPricingContext =
  createPackageMessagesContext<RegistryPricingMessages>("RegistryPricingMessages")

const defaultRegistryPricingI18n: PackageI18nValue<RegistryPricingMessages> = {
  messages: registryPricingEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryPricingMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryPricingMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryPricingMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getRegistryPricingI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: RegistryPricingMessageOverrides | null
}): PackageI18nValue<RegistryPricingMessages> {
  const resolvedLocale = locale ?? fallbackLocale

  return {
    messages: resolveRegistryPricingMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function RegistryPricingMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryPricingMessageOverrides | null
}) {
  return (
    <PricingUiMessagesProvider locale={locale}>
      <registryPricingContext.ResolvedMessagesProvider
        definitions={registryPricingMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryPricingContext.ResolvedMessagesProvider>
    </PricingUiMessagesProvider>
  )
}

export const useRegistryPricingI18n = registryPricingContext.useI18n
export const useRegistryPricingMessages = registryPricingContext.useMessages

export function useRegistryPricingI18nOrDefault() {
  return registryPricingContext.useOptionalI18n() ?? defaultRegistryPricingI18n
}

export function useRegistryPricingMessagesOrDefault() {
  return useRegistryPricingI18nOrDefault().messages
}
