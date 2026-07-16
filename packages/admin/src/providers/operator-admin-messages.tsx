"use client"

import {
  createPackageMessagesContext,
  getLocaleMessageOverridesFromUiPrefs,
  type LocaleMessageOverrides,
  type OperatorAdminMessages,
  operatorAdminMessageDefinitions,
} from "@voyant-travel/i18n"
import type { ReactNode } from "react"

import { DEFAULT_ADMIN_LOCALE, useLocale } from "./locale.js"

export type { OperatorAdminMessages }

export type OperatorAdminMessageOverrides = LocaleMessageOverrides<OperatorAdminMessages>

const operatorAdminMessagesContext =
  createPackageMessagesContext<OperatorAdminMessages>("OperatorAdminMessages")

export function getOperatorAdminMessageOverridesFromUiPrefs(
  uiPrefs: unknown,
): OperatorAdminMessageOverrides | undefined {
  return getLocaleMessageOverridesFromUiPrefs<OperatorAdminMessages>(
    uiPrefs,
    operatorAdminMessageDefinitions,
  )
}

export function OperatorAdminMessagesProvider({
  children,
  overrides,
}: {
  children: ReactNode
  overrides?: OperatorAdminMessageOverrides | null
}) {
  const { resolvedLocale } = useLocale()

  return (
    <operatorAdminMessagesContext.ResolvedMessagesProvider
      definitions={operatorAdminMessageDefinitions}
      fallbackLocale={DEFAULT_ADMIN_LOCALE}
      locale={resolvedLocale}
      overrides={overrides}
    >
      {children}
    </operatorAdminMessagesContext.ResolvedMessagesProvider>
  )
}

export const useOperatorAdminI18n = operatorAdminMessagesContext.useI18n
export const useOptionalOperatorAdminI18n = operatorAdminMessagesContext.useOptionalI18n
export const useOperatorAdminMessages = operatorAdminMessagesContext.useMessages
export const useOptionalOperatorAdminMessages = operatorAdminMessagesContext.useOptionalMessages
