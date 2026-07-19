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

import { mediaUiEn } from "./en.js"
import type { MediaUiMessages } from "./messages.js"
import { mediaUiRo } from "./ro.js"

const fallbackLocale = "en"

export const mediaUiMessageDefinitions = {
  en: mediaUiEn,
  ro: mediaUiRo,
} satisfies LocaleMessageDefinitions<MediaUiMessages>

export type MediaUiMessageOverrides = LocaleMessageOverrides<MediaUiMessages>

const mediaUiContext = createPackageMessagesContext<MediaUiMessages>("MediaUiMessages")

const defaultMediaUiI18n: PackageI18nValue<MediaUiMessages> = {
  messages: mediaUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveMediaUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: MediaUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: mediaUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getMediaUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: MediaUiMessageOverrides | null
}): PackageI18nValue<MediaUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveMediaUiMessages({ locale: resolvedLocale, overrides }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function MediaUiMessagesProvider({
  children,
  locale,
  timeZone,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  timeZone?: string | null
  overrides?: MediaUiMessageOverrides | null
}) {
  return (
    <mediaUiContext.ResolvedMessagesProvider
      definitions={mediaUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      timeZone={timeZone}
      overrides={overrides}
    >
      {children}
    </mediaUiContext.ResolvedMessagesProvider>
  )
}

export const useMediaUiI18n = mediaUiContext.useI18n
export const useMediaUiMessages = mediaUiContext.useMessages

export function useMediaUiI18nOrDefault() {
  return mediaUiContext.useOptionalI18n() ?? defaultMediaUiI18n
}

export function useMediaUiMessagesOrDefault() {
  return useMediaUiI18nOrDefault().messages
}
