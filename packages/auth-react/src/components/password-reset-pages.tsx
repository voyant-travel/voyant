"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
} from "@voyantjs/ui/components"
import { CheckCircle2, Loader2 } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"
import { authUiEn } from "../i18n/en.js"
import type { ForgotPasswordPageMessages, ResetPasswordPageMessages } from "../i18n/messages.js"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"
import { useConfirmPasswordReset, useRequestPasswordReset } from "../index.js"

export type { ForgotPasswordPageMessages, ResetPasswordPageMessages } from "../i18n/messages.js"

export interface ForgotPasswordPageProps {
  className?: string
  messages?: Partial<ForgotPasswordPageMessages>
  redirectTo?: string
  signInHref?: string
  onResetRequested?: (options: { email: string; redirectTo?: string }) => Promise<void> | void
  onNavigateToSignIn?: () => Promise<void> | void
}

export interface ResetPasswordPageProps {
  className?: string
  messages?: Partial<ResetPasswordPageMessages>
  token?: string | null
  minPasswordLength?: number
  signInHref?: string
  forgotPasswordHref?: string
  onPasswordReset?: (options: { token: string }) => Promise<void> | void
  onNavigateToSignIn?: () => Promise<void> | void
  onNavigateToForgotPassword?: () => Promise<void> | void
}

export const defaultForgotPasswordPageMessages = authUiEn.forgotPasswordPage

export const defaultResetPasswordPageMessages = authUiEn.resetPasswordPage

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

function NavigationAction({
  children,
  href,
  onNavigate,
  className,
}: {
  children: ReactNode
  href?: string
  onNavigate?: () => Promise<void> | void
  className?: string
}) {
  const mergedClassName = cn("font-medium text-primary hover:underline", className)

  if (href) {
    return (
      <a
        href={href}
        className={mergedClassName}
        onClick={(event) => {
          if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return
          }

          event.preventDefault()
          void onNavigate()
        }}
      >
        {children}
      </a>
    )
  }

  if (onNavigate) {
    return (
      <button type="button" className={mergedClassName} onClick={() => void onNavigate()}>
        {children}
      </button>
    )
  }

  return null
}

export function ForgotPasswordPage({
  className,
  messages: messageOverrides,
  redirectTo,
  signInHref,
  onResetRequested,
  onNavigateToSignIn,
}: ForgotPasswordPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().forgotPasswordPage
  const messages = { ...defaultMessages, ...messageOverrides }
  const requestReset = useRequestPasswordReset()
  const [email, setEmail] = useState("")
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasSignInAction = Boolean(signInHref || onNavigateToSignIn)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    try {
      await requestReset.mutateAsync({ email: trimmedEmail, redirectTo })
    } catch (err) {
      setError(getErrorMessage(err, messages.somethingWentWrong))
      return
    }

    setSubmittedEmail(trimmedEmail)
    try {
      await onResetRequested?.({ email: trimmedEmail, redirectTo })
    } catch (err) {
      setError(getErrorMessage(err, messages.somethingWentWrong))
    }
  }

  return (
    <Card data-slot="forgot-password-page" className={cn(className)}>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {submittedEmail ? (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="rounded-md bg-muted px-3 py-3 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium">{messages.successTitle}</p>
                  <p className="text-muted-foreground">
                    {messages.successDescription(submittedEmail)}
                  </p>
                </div>
              </div>
            </div>

            {hasSignInAction && (
              <p className="text-center text-sm text-muted-foreground">
                <NavigationAction href={signInHref} onNavigate={onNavigateToSignIn}>
                  {messages.backToSignIn}
                </NavigationAction>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auth-forgot-password-email">{messages.emailLabel}</Label>
              <Input
                id="auth-forgot-password-email"
                type="email"
                placeholder={messages.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={requestReset.isPending}>
              {requestReset.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              )}
              {requestReset.isPending ? messages.submitting : messages.submit}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export function ResetPasswordPage({
  className,
  messages: messageOverrides,
  token,
  minPasswordLength = 8,
  signInHref,
  forgotPasswordHref,
  onPasswordReset,
  onNavigateToSignIn,
  onNavigateToForgotPassword,
}: ResetPasswordPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().resetPasswordPage
  const messages = { ...defaultMessages, ...messageOverrides }
  const confirmReset = useConfirmPasswordReset()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const resolvedToken = token?.trim() ?? ""
  const hasForgotPasswordAction = Boolean(forgotPasswordHref || onNavigateToForgotPassword)
  const hasSignInAction = Boolean(signInHref || onNavigateToSignIn)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!resolvedToken) {
      setError(messages.tokenRequired)
      return
    }

    if (!newPassword) {
      setError(messages.passwordRequired)
      return
    }

    if (newPassword.length < minPasswordLength) {
      setError(messages.passwordTooShort(minPasswordLength))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(messages.passwordsDoNotMatch)
      return
    }

    try {
      await confirmReset.mutateAsync({ token: resolvedToken, newPassword })
    } catch (err) {
      setError(getErrorMessage(err, messages.somethingWentWrong))
      return
    }

    setSucceeded(true)
    setNewPassword("")
    setConfirmPassword("")
    try {
      await onPasswordReset?.({ token: resolvedToken })
    } catch (err) {
      setError(getErrorMessage(err, messages.somethingWentWrong))
    }
  }

  return (
    <Card data-slot="reset-password-page" className={cn(className)}>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!resolvedToken ? (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {messages.tokenRequired}
            </div>
            {hasForgotPasswordAction && (
              <p className="text-center text-sm text-muted-foreground">
                <NavigationAction href={forgotPasswordHref} onNavigate={onNavigateToForgotPassword}>
                  {messages.requestNewLink}
                </NavigationAction>
              </p>
            )}
          </div>
        ) : succeeded ? (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="rounded-md bg-muted px-3 py-3 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium">{messages.successTitle}</p>
                  <p className="text-muted-foreground">{messages.successDescription}</p>
                </div>
              </div>
            </div>
            {hasSignInAction && (
              <p className="text-center text-sm text-muted-foreground">
                <NavigationAction href={signInHref} onNavigate={onNavigateToSignIn}>
                  {messages.signIn}
                </NavigationAction>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auth-reset-password-new">{messages.newPasswordLabel}</Label>
              <Input
                id="auth-reset-password-new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={minPasswordLength}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-reset-password-confirm">{messages.confirmPasswordLabel}</Label>
              <Input
                id="auth-reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={minPasswordLength}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={confirmReset.isPending}>
              {confirmReset.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              )}
              {confirmReset.isPending ? messages.submitting : messages.submit}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
