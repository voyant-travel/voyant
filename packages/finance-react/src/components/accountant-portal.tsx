"use client"

import { useMemo, useState } from "react"
import {
  FinanceUiMessagesProvider,
  financeUiMessageDefinitions,
  getFinanceUiI18n,
} from "../i18n/index.js"
import { AccountantPortalBody } from "./accountant-portal/body.js"

const LOCALES = Object.keys(financeUiMessageDefinitions)

function initialLocale(defaultLocale?: string): string {
  const candidates = [defaultLocale, typeof navigator !== "undefined" ? navigator.language : null]
  for (const c of candidates) {
    const code = c?.toLowerCase().split("-")[0]
    if (code && LOCALES.includes(code)) return code
  }
  return "en"
}

export interface AccountantPortalProps {
  token: string
  /** Absolute API origin used for the public portal endpoints + download links. */
  apiBaseUrl: string
  className?: string
  /** Initial language (operator's configured locale); the accountant can switch. */
  defaultLocale?: string
}

export function AccountantPortal({ defaultLocale, ...props }: AccountantPortalProps) {
  const [locale, setLocale] = useState(() => initialLocale(defaultLocale))
  // Resolve messages directly from the chosen locale and pass them down, so the
  // portal localizes regardless of any ambient FinanceUiMessagesProvider locale.
  const messages = useMemo(() => getFinanceUiI18n({ locale }).messages, [locale])
  return (
    <FinanceUiMessagesProvider locale={locale}>
      <AccountantPortalBody
        {...props}
        messages={messages}
        locale={locale}
        onLocaleChange={setLocale}
      />
    </FinanceUiMessagesProvider>
  )
}
