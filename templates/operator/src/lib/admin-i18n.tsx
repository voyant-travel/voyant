import { DEFAULT_ADMIN_LOCALE, useLocale } from "@voyantjs/admin"
import {
  composeLocaleMessageDefinitions,
  getLocaleMessageOverridesFromUiPrefs,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  MessagesProvider,
  type OperatorAdminMessages,
  operatorAdminMessageDefinitions,
  useMessages,
  useResolvedLocaleMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

export type AdminMessages = OperatorAdminMessages

export type AdminMessageOverrides = LocaleMessageOverrides<AdminMessages>

const adminMessages = composeLocaleMessageDefinitions<AdminMessages>(
  operatorAdminMessageDefinitions,
) satisfies LocaleMessageDefinitions<AdminMessages>

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
    definitions: adminMessages,
    overrides,
  })

  return <MessagesProvider messages={messages}>{children}</MessagesProvider>
}

export function useAdminMessages(): AdminMessages {
  return useMessages<AdminMessages>()
}
