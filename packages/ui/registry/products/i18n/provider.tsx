"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  formatMessage,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import { ProductsUiMessagesProvider } from "@voyantjs/products-ui"
import type { ReactNode } from "react"

import { registryProductsEn } from "./en"
import type { RegistryProductsMessages } from "./messages"
import { registryProductsRo } from "./ro"

const fallbackLocale = "en"

export const registryProductsMessageDefinitions = {
  en: registryProductsEn,
  ro: registryProductsRo,
} satisfies LocaleMessageDefinitions<RegistryProductsMessages>

export type RegistryProductsMessageOverrides = LocaleMessageOverrides<RegistryProductsMessages>

const registryProductsContext = createPackageMessagesContext<RegistryProductsMessages>(
  "RegistryProductsMessages",
)

const defaultRegistryProductsI18n: PackageI18nValue<RegistryProductsMessages> = {
  messages: registryProductsEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveRegistryProductsMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: RegistryProductsMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: registryProductsMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getRegistryProductsI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: RegistryProductsMessageOverrides | null
}): PackageI18nValue<RegistryProductsMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveRegistryProductsMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function RegistryProductsMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: RegistryProductsMessageOverrides | null
}) {
  return (
    <ProductsUiMessagesProvider locale={locale}>
      <registryProductsContext.ResolvedMessagesProvider
        definitions={registryProductsMessageDefinitions}
        fallbackLocale={fallbackLocale}
        locale={locale}
        overrides={overrides}
      >
        {children}
      </registryProductsContext.ResolvedMessagesProvider>
    </ProductsUiMessagesProvider>
  )
}

export const useRegistryProductsI18n = registryProductsContext.useI18n
export const useRegistryProductsMessages = registryProductsContext.useMessages

export function useRegistryProductsI18nOrDefault() {
  return registryProductsContext.useOptionalI18n() ?? defaultRegistryProductsI18n
}

export function useRegistryProductsMessagesOrDefault() {
  return useRegistryProductsI18nOrDefault().messages
}

export { formatMessage }
