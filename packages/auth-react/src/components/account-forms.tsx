"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from "@voyant-travel/ui/components"
import { KeyRound, Loader2, Mail, Save, UserRound } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type ConfirmAccountEmailChangeInput,
  type CurrentUser,
  useChangeAccountPassword,
  useConfirmAccountEmailChange,
  useCurrentUser,
  useRequestAccountEmailChange,
  useUpdateAccountProfile,
} from "../index.js"
import {
  type AccountChangeEmailFormMessages,
  type AccountChangePasswordFormMessages,
  type AccountProfileFormMessages,
  messageFromError,
} from "./account-page-shared.js"

export interface AccountProfileFormProps {
  className?: string
  currentUser?: CurrentUser | null
  messages?: Partial<AccountProfileFormMessages>
  onUpdated?: (user: CurrentUser) => Promise<void> | void
}

export interface AccountChangeEmailFormProps {
  className?: string
  currentEmail?: string | null
  messages?: Partial<AccountChangeEmailFormMessages>
  onCodeSent?: (input: { newEmail: string }) => Promise<void> | void
  onChanged?: (input: ConfirmAccountEmailChangeInput) => Promise<void> | void
}

export interface AccountChangePasswordFormProps {
  className?: string
  messages?: Partial<AccountChangePasswordFormMessages>
  minPasswordLength?: number
  revokeOtherSessionsDefault?: boolean
  onChanged?: () => Promise<void> | void
}

export function AccountProfileForm({
  className,
  currentUser,
  messages: messageOverrides,
  onUpdated,
}: AccountProfileFormProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().accountPage.profile
  const messages = { ...defaultMessages, ...messageOverrides }
  const userQuery = useCurrentUser({ enabled: currentUser === undefined })
  const user = currentUser === undefined ? (userQuery.data ?? null) : currentUser
  const mutation = useUpdateAccountProfile()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [profilePictureUrl, setProfilePictureUrl] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName ?? "")
    setLastName(user.lastName ?? "")
    setProfilePictureUrl(user.profilePictureUrl ?? "")
  }, [user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStatus(null)

    try {
      const updated = await mutation.mutateAsync({
        firstName,
        lastName,
        profilePictureUrl: profilePictureUrl.trim() || null,
      })
      await onUpdated?.(updated)
      setStatus(messages.success)
    } catch (err) {
      setError(messageFromError(err, messages.error))
    }
  }

  return (
    <Card data-slot="account-profile-form" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4" />
          {messages.title}
        </CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {userQuery.isError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {messages.loadFailed}
          </div>
        ) : null}

        {!user && !userQuery.isLoading ? (
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            {messages.noUser}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {status ? (
            <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{status}</div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-profile-first-name">{messages.firstNameLabel}</Label>
              <Input
                id="account-profile-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder={messages.firstNamePlaceholder}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-profile-last-name">{messages.lastNameLabel}</Label>
              <Input
                id="account-profile-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder={messages.lastNamePlaceholder}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-profile-picture-url">{messages.profilePictureUrlLabel}</Label>
            <Input
              id="account-profile-picture-url"
              value={profilePictureUrl}
              onChange={(event) => setProfilePictureUrl(event.target.value)}
              placeholder={messages.profilePictureUrlPlaceholder}
              autoComplete="photo"
            />
          </div>

          <Button type="submit" disabled={!user || mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mutation.isPending ? messages.saving : messages.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function AccountChangeEmailForm({
  className,
  currentEmail,
  messages: messageOverrides,
  onCodeSent,
  onChanged,
}: AccountChangeEmailFormProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().accountPage.email
  const messages = { ...defaultMessages, ...messageOverrides }
  const requestEmailChange = useRequestAccountEmailChange()
  const confirmEmailChange = useConfirmAccountEmailChange()
  const [newEmail, setNewEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStatus(null)

    const trimmedEmail = newEmail.trim()
    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    try {
      await requestEmailChange.mutateAsync({ newEmail: trimmedEmail })
      await onCodeSent?.({ newEmail: trimmedEmail })
      setCodeSentTo(trimmedEmail)
      setVerificationCode("")
      setStatus(messages.codeSent)
    } catch (err) {
      setError(messageFromError(err, messages.error))
    }
  }

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStatus(null)

    const trimmedCode = verificationCode.trim()
    if (!codeSentTo) {
      setError(messages.emailRequired)
      return
    }

    if (!trimmedCode) {
      setError(messages.codeRequired)
      return
    }

    try {
      const input = { newEmail: codeSentTo, otp: trimmedCode }
      await confirmEmailChange.mutateAsync(input)
      await onChanged?.(input)
      setNewEmail("")
      setVerificationCode("")
      setCodeSentTo(null)
      setStatus(messages.success)
    } catch (err) {
      setError(messageFromError(err, messages.error))
    }
  }

  return (
    <Card data-slot="account-change-email-form" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          {messages.title}
        </CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{status}</div>
        ) : null}

        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-current-email">{messages.currentEmailLabel}</Label>
            <Input
              id="account-current-email"
              value={currentEmail ?? messages.currentEmailMissing}
              readOnly
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-new-email">{messages.newEmailLabel}</Label>
            <Input
              id="account-new-email"
              type="email"
              value={newEmail}
              onChange={(event) => {
                const value = event.target.value
                setNewEmail(value)
                if (codeSentTo && value.trim().toLowerCase() !== codeSentTo.toLowerCase()) {
                  setCodeSentTo(null)
                  setVerificationCode("")
                }
              }}
              placeholder={messages.newEmailPlaceholder}
              autoComplete="email"
              required
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={requestEmailChange.isPending || newEmail.trim().length === 0}
          >
            {requestEmailChange.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {requestEmailChange.isPending ? messages.sendingCode : messages.sendCode}
          </Button>
        </form>

        {codeSentTo ? (
          <form onSubmit={handleConfirm} className="space-y-4 border-t pt-5">
            <div className="space-y-2">
              <Label htmlFor="account-email-verification-code">
                {messages.verificationCodeLabel}
              </Label>
              <Input
                id="account-email-verification-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder={messages.verificationCodePlaceholder}
                inputMode="numeric"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={confirmEmailChange.isPending || verificationCode.trim().length === 0}
            >
              {confirmEmailChange.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {confirmEmailChange.isPending ? messages.confirming : messages.confirm}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AccountChangePasswordForm({
  className,
  messages: messageOverrides,
  minPasswordLength = 8,
  revokeOtherSessionsDefault = true,
  onChanged,
}: AccountChangePasswordFormProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().accountPage.password
  const messages = { ...defaultMessages, ...messageOverrides }
  const mutation = useChangeAccountPassword()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(revokeOtherSessionsDefault)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStatus(null)

    if (!currentPassword) {
      setError(messages.currentPasswordRequired)
      return
    }

    if (!newPassword) {
      setError(messages.newPasswordRequired)
      return
    }

    if (newPassword.length < minPasswordLength) {
      setError(messages.passwordTooShort)
      return
    }

    if (newPassword !== confirmPassword) {
      setError(messages.passwordsDoNotMatch)
      return
    }

    try {
      await mutation.mutateAsync({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      })
      await onChanged?.()
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setStatus(messages.success)
    } catch (err) {
      setError(messageFromError(err, messages.error))
    }
  }

  return (
    <Card data-slot="account-change-password-form" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {messages.title}
        </CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {status ? (
            <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{status}</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="account-current-password">{messages.currentPasswordLabel}</Label>
              <Input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-new-password">{messages.newPasswordLabel}</Label>
              <Input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-confirm-password">{messages.confirmPasswordLabel}</Label>
              <Input
                id="account-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <label
            htmlFor="account-revoke-other-sessions"
            className="flex cursor-pointer items-center gap-3 text-sm"
          >
            <Checkbox
              id="account-revoke-other-sessions"
              checked={revokeOtherSessions}
              onCheckedChange={(value) => setRevokeOtherSessions(value === true)}
            />
            <span>{messages.revokeOtherSessionsLabel}</span>
          </label>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mutation.isPending ? messages.saving : messages.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
