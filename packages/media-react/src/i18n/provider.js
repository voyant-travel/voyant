"use client"
import {
  createLocaleFormatters,
  createPackageMessagesContext,
  resolvePackageMessages,
} from "@voyant-travel/i18n"
import { jsx as _jsx } from "react/jsx-runtime"
import { mediaUiEn } from "./en.js"
import { mediaUiRo } from "./ro.js"

const fallbackLocale = "en"
export const mediaUiMessageDefinitions = {
  en: mediaUiEn,
  ro: mediaUiRo,
}
const mediaUiContext = createPackageMessagesContext("MediaUiMessages")
const defaultMediaUiI18n = {
  messages: mediaUiEn,
  ...createLocaleFormatters(fallbackLocale),
}
export function resolveMediaUiMessages({ locale, overrides }) {
  return resolvePackageMessages({
    definitions: mediaUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}
export function getMediaUiI18n({ locale, overrides }) {
  const resolvedLocale = locale ?? fallbackLocale
  return {
    messages: resolveMediaUiMessages({ locale: resolvedLocale, overrides }),
    ...createLocaleFormatters(resolvedLocale),
  }
}
export function MediaUiMessagesProvider({ children, locale, timeZone, overrides }) {
  return _jsx(mediaUiContext.ResolvedMessagesProvider, {
    definitions: mediaUiMessageDefinitions,
    fallbackLocale: fallbackLocale,
    locale: locale,
    timeZone: timeZone,
    overrides: overrides,
    children: children,
  })
}
export const useMediaUiI18n = mediaUiContext.useI18n
export const useMediaUiMessages = mediaUiContext.useMessages
export function useMediaUiI18nOrDefault() {
  return mediaUiContext.useOptionalI18n() ?? defaultMediaUiI18n
}
export function useMediaUiMessagesOrDefault() {
  return useMediaUiI18nOrDefault().messages
}
