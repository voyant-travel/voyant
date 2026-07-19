import { type LocaleMessageOverrides, type PackageI18nValue } from "@voyant-travel/i18n"
import type { ReactNode } from "react"
import type { MediaUiMessages } from "./messages.js"
export declare const mediaUiMessageDefinitions: {
  en: MediaUiMessages
  ro: MediaUiMessages
}
export type MediaUiMessageOverrides = LocaleMessageOverrides<MediaUiMessages>
export declare function resolveMediaUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: MediaUiMessageOverrides | null
}): MediaUiMessages
export declare function getMediaUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: MediaUiMessageOverrides | null
}): PackageI18nValue<MediaUiMessages>
export declare function MediaUiMessagesProvider({
  children,
  locale,
  timeZone,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  timeZone?: string | null
  overrides?: MediaUiMessageOverrides | null
}): import("react").JSX.Element
export declare const useMediaUiI18n: () => PackageI18nValue<MediaUiMessages>
export declare const useMediaUiMessages: () => MediaUiMessages
export declare function useMediaUiI18nOrDefault(): PackageI18nValue<MediaUiMessages>
export declare function useMediaUiMessagesOrDefault(): MediaUiMessages
