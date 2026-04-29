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
import { BookingRequirementsUiMessagesProvider } from "../../../../booking-requirements-ui/src/index"

import { registryBookingRequirementsEn } from "./en"
import type { RegistryBookingRequirementsMessages } from "./messages"
import { registryBookingRequirementsRo } from "./ro"

const fallbackLocale = "en"

export const registryBookingRequirementsMessageDefinitions = {
  en: registryBookingRequirementsEn,
  ro: registryBookingRequirementsRo,
} satisfies LocaleMessageDefinitions<RegistryBookingRequirementsMessages>

export type RegistryBookingRequirementsMessageOverrides =
  LocaleMessageOverrides<RegistryBookingRequirementsMessages>

const registryBookingRequirementsContext =
  createPackageMessagesContext<RegistryBookingRequirementsMessages>(
    "RegistryBookingRequirementsMessages",
  )

const defaultRegistryBookingRequirementsI18n: PackageI18nValue<RegistryBookingRequirementsMessages> =
  {
    messages: registryBookingRequirementsEn,
    ...createLocaleFormatters(fallbackLocale),
  }

export function resolveRegistryBookingRequirementsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryBookingRequirementsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryBookingRequirementsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function RegistryBookingRequirementsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryBookingRequirementsMessageOverrides | null
}) {
  return (
    <BookingRequirementsUiMessagesProvider locale={locale}>
      <registryBookingRequirementsContext.ResolvedMessagesProvider
        definitions={registryBookingRequirementsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryBookingRequirementsContext.ResolvedMessagesProvider>
    </BookingRequirementsUiMessagesProvider>
  )
}

export const useRegistryBookingRequirementsI18n = registryBookingRequirementsContext.useI18n
export const useRegistryBookingRequirementsMessages = registryBookingRequirementsContext.useMessages

export function useRegistryBookingRequirementsI18nOrDefault() {
  return (
    registryBookingRequirementsContext.useOptionalI18n() ?? defaultRegistryBookingRequirementsI18n
  )
}

export function useRegistryBookingRequirementsMessagesOrDefault() {
  return useRegistryBookingRequirementsI18nOrDefault().messages
}
