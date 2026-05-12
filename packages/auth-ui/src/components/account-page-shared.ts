import type { CurrentUser } from "@voyantjs/auth-react"
import type { ReactNode } from "react"

export interface AccountProfileFormMessages {
  title: string
  description: string
  firstNameLabel: string
  firstNamePlaceholder: string
  lastNameLabel: string
  lastNamePlaceholder: string
  profilePictureUrlLabel: string
  profilePictureUrlPlaceholder: string
  submit: string
  saving: string
  success: string
  loadFailed: string
  noUser: string
  error: string
}

export interface AccountChangeEmailFormMessages {
  title: string
  description: string
  currentEmailLabel: string
  currentEmailMissing: string
  newEmailLabel: string
  newEmailPlaceholder: string
  verificationCodeLabel: string
  verificationCodePlaceholder: string
  sendCode: string
  sendingCode: string
  confirm: string
  confirming: string
  codeSent: string
  success: string
  emailRequired: string
  codeRequired: string
  error: string
}

export interface AccountChangePasswordFormMessages {
  title: string
  description: string
  currentPasswordLabel: string
  newPasswordLabel: string
  confirmPasswordLabel: string
  revokeOtherSessionsLabel: string
  submit: string
  saving: string
  success: string
  currentPasswordRequired: string
  newPasswordRequired: string
  passwordsDoNotMatch: string
  passwordTooShort: string
  error: string
}

export interface AccountPageMessages {
  title: string
  description: string
  loading: string
  loadFailed: string
  profile: AccountProfileFormMessages
  email: AccountChangeEmailFormMessages
  password: AccountChangePasswordFormMessages
}

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

export type PartialAccountPageMessages = Partial<
  Omit<AccountPageMessages, "profile" | "email" | "password">
> & {
  profile?: Partial<AccountProfileFormMessages>
  email?: Partial<AccountChangeEmailFormMessages>
  password?: Partial<AccountChangePasswordFormMessages>
}

export const defaultAccountPageMessages: AccountPageMessages = {
  title: "Account",
  description: "Manage your profile, sign-in email, and password.",
  loading: "Loading account...",
  loadFailed: "Could not load the current account.",
  profile: {
    title: "Profile",
    description: "Update the name and avatar shown across operator tools.",
    firstNameLabel: "First name",
    firstNamePlaceholder: "Ana",
    lastNameLabel: "Last name",
    lastNamePlaceholder: "Popescu",
    profilePictureUrlLabel: "Profile picture URL",
    profilePictureUrlPlaceholder: "https://example.com/avatar.png",
    submit: "Save profile",
    saving: "Saving",
    success: "Profile updated.",
    loadFailed: "Could not load profile details.",
    noUser: "No signed-in user was found.",
    error: "Could not update the profile.",
  },
  email: {
    title: "Change email",
    description: "Send a verification code to the new email address before changing it.",
    currentEmailLabel: "Current email",
    currentEmailMissing: "No email is set.",
    newEmailLabel: "New email",
    newEmailPlaceholder: "name@example.com",
    verificationCodeLabel: "Verification code",
    verificationCodePlaceholder: "Enter the 6-digit code",
    sendCode: "Send code",
    sendingCode: "Sending",
    confirm: "Verify and change email",
    confirming: "Updating",
    codeSent: "Verification code sent.",
    success: "Email updated.",
    emailRequired: "Enter a new email address.",
    codeRequired: "Enter the verification code.",
    error: "Could not change the email address.",
  },
  password: {
    title: "Change password",
    description: "Use your current password to set a new one.",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password",
    confirmPasswordLabel: "Confirm new password",
    revokeOtherSessionsLabel: "Sign out other sessions",
    submit: "Update password",
    saving: "Updating",
    success: "Password updated.",
    currentPasswordRequired: "Enter your current password.",
    newPasswordRequired: "Enter a new password.",
    passwordsDoNotMatch: "The new passwords do not match.",
    passwordTooShort: "The new password is too short.",
    error: "Could not update the password.",
  },
}

export function mergeAccountPageMessages(
  overrides?: PartialAccountPageMessages,
): AccountPageMessages {
  return {
    ...defaultAccountPageMessages,
    ...overrides,
    profile: { ...defaultAccountPageMessages.profile, ...overrides?.profile },
    email: { ...defaultAccountPageMessages.email, ...overrides?.email },
    password: { ...defaultAccountPageMessages.password, ...overrides?.password },
  }
}

export function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
