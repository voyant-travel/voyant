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
import { authUiEn } from "../i18n/en.js"
import type { SignUpPageMessages } from "../i18n/messages.js"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"
import { useSignUp } from "../index.js"

export type { SignUpPageMessages } from "../i18n/messages.js"

export interface SignUpSocialProvider {
  id: string
  label: string
  icon?: ReactNode
  onSignUp: (options: { redirectTo?: string; invitationToken?: string }) => Promise<void> | void
}

export interface SignUpEmailSubmitInput {
  name: string
  email: string
  password: string
  redirectTo?: string
  invitationToken?: string
}

export interface SignUpPageProps {
  className?: string
  messages?: Partial<SignUpPageMessages>
  redirectTo?: string
  signInHref?: string
  invitationToken?: string
  showInvitationTokenInput?: boolean
  socialProviders?: readonly SignUpSocialProvider[]
  onEmailSignUp?: (input: SignUpEmailSubmitInput) => Promise<unknown> | unknown
  onSignedUp?: (options: {
    data: unknown
    email: string
    redirectTo?: string
    invitationToken?: string
  }) => Promise<void> | void
}

export const defaultSignUpPageMessages = authUiEn.signUpPage

function errorMessage(error: unknown, messages: SignUpPageMessages): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return messages.couldNotCreateAccount
}

export function SignUpPage({
  className,
  messages: messageOverrides,
  redirectTo,
  signInHref,
  invitationToken,
  showInvitationTokenInput = false,
  socialProviders = [],
  onEmailSignUp,
  onSignedUp,
}: SignUpPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().signUpPage
  const messages = { ...defaultMessages, ...messageOverrides }
  const signUp = useSignUp()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [invitationTokenValue, setInvitationTokenValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)
  const [pendingSocialProvider, setPendingSocialProvider] = useState<string | null>(null)

  const isSubmitting = signUp.email.isPending || isSubmittingEmail
  const hasSocialProviders = socialProviders.length > 0
  const collectsInvitationToken = showInvitationTokenInput && invitationToken === undefined
  const resolvedInvitationToken = (invitationToken ?? invitationTokenValue).trim() || undefined

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) {
      setError(messages.nameRequired)
      return
    }

    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    if (!password) {
      setError(messages.passwordRequired)
      return
    }

    try {
      if (resolvedInvitationToken && !onEmailSignUp) {
        setError(messages.invitationSignUpRequiresHandler)
        return
      }

      setIsSubmittingEmail(true)
      const data = onEmailSignUp
        ? await onEmailSignUp({
            name: trimmedName,
            email: trimmedEmail,
            password,
            redirectTo,
            invitationToken: resolvedInvitationToken,
          })
        : (
            await signUp.email.mutateAsync({
              name: trimmedName,
              email: trimmedEmail,
              password,
              callbackURL: redirectTo,
            })
          ).data

      await onSignedUp?.({
        data,
        email: trimmedEmail,
        redirectTo,
        invitationToken: resolvedInvitationToken,
      })
    } catch (err) {
      setError(errorMessage(err, messages))
    } finally {
      setIsSubmittingEmail(false)
    }
  }

  const handleSocialSignUp = async (provider: SignUpSocialProvider) => {
    setError(null)
    setPendingSocialProvider(provider.id)
    try {
      await provider.onSignUp({ redirectTo, invitationToken: resolvedInvitationToken })
    } catch {
      setError(messages.somethingWentWrong)
      setPendingSocialProvider(null)
    }
  }

  return (
    <Card data-slot="sign-up-page" className={cn(className)}>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="auth-sign-up-name">{messages.nameLabel}</Label>
            <Input
              id="auth-sign-up-name"
              type="text"
              placeholder={messages.namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-sign-up-email">{messages.emailLabel}</Label>
            <Input
              id="auth-sign-up-email"
              type="email"
              placeholder={messages.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-sign-up-password">{messages.passwordLabel}</Label>
            <Input
              id="auth-sign-up-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {collectsInvitationToken && (
            <div className="space-y-2">
              <Label htmlFor="auth-sign-up-invitation-token">{messages.invitationTokenLabel}</Label>
              <Input
                id="auth-sign-up-invitation-token"
                type="text"
                placeholder={messages.invitationTokenPlaceholder}
                value={invitationTokenValue}
                onChange={(event) => setInvitationTokenValue(event.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? messages.signingUp : messages.submit}
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
                    onClick={() => void handleSocialSignUp(provider)}
                  >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : provider.icon}
                    {provider.label}
                  </Button>
                )
              })}
            </div>
          </>
        )}

        {signInHref && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {messages.haveAccount}{" "}
            <a href={signInHref} className="font-medium text-primary hover:underline">
              {messages.signIn}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
