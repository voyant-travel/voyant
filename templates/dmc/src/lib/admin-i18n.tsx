import { DEFAULT_ADMIN_LOCALE, useLocale } from "@voyantjs/admin"
import {
  type DmcAdminMessages,
  dmcAdminMessageDefinitions,
  getLocaleMessageOverridesFromUiPrefs,
  type LocaleMessageOverrides,
  MessagesProvider,
  useMessages,
  useResolvedLocaleMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

export type AdminMessages = DmcAdminMessages

export type AdminMessageOverrides = LocaleMessageOverrides<AdminMessages>

export function getAdminMessageOverridesFromUiPrefs(
  uiPrefs: unknown,
): AdminMessageOverrides | undefined {
  return getLocaleMessageOverridesFromUiPrefs<AdminMessages>(uiPrefs)
}

export function AdminI18nProvider({
  children,
  overrides,
}: {
  children: ReactNode
  overrides?: AdminMessageOverrides
}) {
  const { resolvedLocale } = useLocale()
  const messages = useResolvedLocaleMessages({
    locale: resolvedLocale,
    fallbackLocale: DEFAULT_ADMIN_LOCALE,
    definitions: dmcAdminMessageDefinitions,
    overrides,
  })

  return <MessagesProvider messages={messages}>{children}</MessagesProvider>
}

export function useAdminMessages(): AdminMessages {
  return useMessages<AdminMessages>()
}
