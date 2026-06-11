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
import { Loader2 } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"
import { VoyantApiError } from "../client.js"
import { authUiEn } from "../i18n/en.js"
import type { SignInPageMessages } from "../i18n/messages.js"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"
import { useSignIn } from "../index.js"

export type { SignInPageMessages } from "../i18n/messages.js"

export interface SignInSocialProvider {
  id: string
  label: string
  icon?: ReactNode
  onSignIn: (options: { redirectTo?: string }) => Promise<void> | void
}

export interface SignInPageProps {
  className?: string
  messages?: Partial<SignInPageMessages>
  redirectTo?: string
  forgotPasswordHref?: string
  signUpHref?: string
  socialProviders?: readonly SignInSocialProvider[]
  onSignedIn?: (options: { redirectTo?: string }) => Promise<void> | void
  onResendVerification?: (email: string) => Promise<void> | void
}

export const defaultSignInPageMessages = authUiEn.signInPage

function isEmailNotVerified(error: unknown): boolean {
  if (error instanceof VoyantApiError && error.status === 403) {
    return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes("not verified")
  }

  return false
}

function errorMessage(error: unknown, messages: SignInPageMessages): string {
  if (isEmailNotVerified(error)) {
    return messages.emailNotVerified
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return messages.invalidEmailOrPassword
}

export function SignInPage({
  className,
  messages: messageOverrides,
  redirectTo,
  forgotPasswordHref,
  signUpHref,
  socialProviders = [],
  onSignedIn,
  onResendVerification,
}: SignInPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().signInPage
  const messages = { ...defaultMessages, ...messageOverrides }
  const signIn = useSignIn()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [pendingSocialProvider, setPendingSocialProvider] = useState<string | null>(null)

  const isSubmitting = signIn.email.isPending
  const hasSocialProviders = socialProviders.length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setEmailNotVerified(false)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    if (!password) {
      setError(messages.passwordRequired)
      return
    }

    try {
      await signIn.email.mutateAsync({ email: trimmedEmail, password, callbackURL: redirectTo })
      await onSignedIn?.({ redirectTo })
    } catch (err) {
      const needsVerification = isEmailNotVerified(err)
      setEmailNotVerified(needsVerification)
      setError(errorMessage(err, messages))
    }
  }

  const handleResendVerification = async () => {
    if (!onResendVerification) {
      return
    }

    setError(null)
    setResendingVerification(true)
    try {
      await onResendVerification(email.trim())
    } catch {
      setError(messages.somethingWentWrong)
    } finally {
      setResendingVerification(false)
    }
  }

  const handleSocialSignIn = async (provider: SignInSocialProvider) => {
    setError(null)
    setPendingSocialProvider(provider.id)
    try {
      await provider.onSignIn({ redirectTo })
    } catch {
      setError(messages.somethingWentWrong)
      setPendingSocialProvider(null)
    }
  }

  return (
    <Card data-slot="sign-in-page" className={cn(className)}>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              {emailNotVerified && onResendVerification && (
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={resendingVerification}
                  className="mt-2 font-medium underline hover:no-underline disabled:opacity-50"
                >
                  {resendingVerification ? messages.sending : messages.resendVerificationCode}
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="auth-sign-in-email">{messages.emailLabel}</Label>
            <Input
              id="auth-sign-in-email"
              type="email"
              placeholder={messages.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auth-sign-in-password">{messages.passwordLabel}</Label>
              {forgotPasswordHref && (
                <a
                  href={forgotPasswordHref}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {messages.forgotPassword}
                </a>
              )}
            </div>
            <Input
              id="auth-sign-in-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? messages.signingIn : messages.submit}
          </Button>
        </form>

        {hasSocialProviders && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase text-muted-foreground">{messages.or}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              {socialProviders.map((provider) => {
                const isPending = pendingSocialProvider === provider.id
                return (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="w-full"
                    type="button"
                    disabled={pendingSocialProvider !== null}
                    onClick={() => void handleSocialSignIn(provider)}
                  >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : provider.icon}
                    {provider.label}
                  </Button>
                )
              })}
            </div>
          </>
        )}

        {signUpHref && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {messages.noAccount}{" "}
            <a href={signUpHref} className="font-medium text-primary hover:underline">
              {messages.signUp}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
