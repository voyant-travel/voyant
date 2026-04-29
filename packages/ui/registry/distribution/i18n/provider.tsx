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

import { DistributionUiMessagesProvider } from "../../../../distribution-ui/src/index"
import { registryDistributionEn } from "./en"
import type { RegistryDistributionMessages } from "./messages"
import { registryDistributionRo } from "./ro"

const fallbackLocale = "en"

export const registryDistributionMessageDefinitions = {
  en: registryDistributionEn,
  ro: registryDistributionRo,
} satisfies LocaleMessageDefinitions<RegistryDistributionMessages>

export type RegistryDistributionMessageOverrides =
  LocaleMessageOverrides<RegistryDistributionMessages>

const registryDistributionContext = createPackageMessagesContext<RegistryDistributionMessages>(
  "RegistryDistributionMessages",
)

const defaultRegistryDistributionI18n: PackageI18nValue<RegistryDistributionMessages> = {
  messages: registryDistributionEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryDistributionMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryDistributionMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryDistributionMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryDistributionMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryDistributionMessageOverrides | null
}) {
  return (
    <DistributionUiMessagesProvider locale={locale}>
      <registryDistributionContext.ResolvedMessagesProvider
        definitions={registryDistributionMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryDistributionContext.ResolvedMessagesProvider>
    </DistributionUiMessagesProvider>
  )
}

export const useRegistryDistributionI18n = registryDistributionContext.useI18n
export const useRegistryDistributionMessages = registryDistributionContext.useMessages

export function useRegistryDistributionI18nOrDefault() {
  return registryDistributionContext.useOptionalI18n() ?? defaultRegistryDistributionI18n
}

export function useRegistryDistributionMessagesOrDefault() {
  return useRegistryDistributionI18nOrDefault().messages
}
