import type { CurrentUser } from "@voyantjs/auth-react"
import type { ReactNode } from "react"

import { authUiEn } from "../i18n/en.js"
import type { AccountPageMessages, PartialAccountPageMessages } from "../i18n/messages.js"

export type {
  AccountChangeEmailFormMessages,
  AccountChangePasswordFormMessages,
  AccountPageMessages,
  AccountProfileFormMessages,
  PartialAccountPageMessages,
} from "../i18n/messages.js"

export interface AccountPageRenderContext {
  user: CurrentUser | null
  refreshUser: () => Promise<unknown>
}

export type AccountPageSlot = ReactNode | ((context: AccountPageRenderContext) => ReactNode)

export interface AccountPageSlots {
  /**
   * Renders beside the built-in profile form. Use for app-owned preferences.
   */
  profilePanel?: AccountPageSlot
  /**
   * Renders beside the built-in password/email forms. Use for security panels
   * such as sessions, MFA enrollment, or recovery codes.
   */
  securityPanel?: AccountPageSlot
  /**
   * Renders after the built-in forms. Intended for panels such as API tokens.
   */
  apiTokensPanel?: AccountPageSlot
  afterContent?: AccountPageSlot
}

export const defaultAccountPageMessages = authUiEn.accountPage

export function mergeAccountPageMessages(
  overrides?: PartialAccountPageMessages,
  defaults: AccountPageMessages = defaultAccountPageMessages,
): AccountPageMessages {
  return {
    ...defaults,
    ...overrides,
    profile: { ...defaults.profile, ...overrides?.profile },
    email: { ...defaults.email, ...overrides?.email },
    password: { ...defaults.password, ...overrides?.password },
  }
}

export function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
