"use client"

import { useSignUp } from "@voyantjs/auth-react"
import { Button, cn, Input, Label } from "@voyantjs/ui/components"
import { Loader2, UserPlus } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"

export interface SignUpPageMessages {
  title: string
  description: string
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  invitationTokenLabel: string
  invitationTokenPlaceholder: string
  submit: string
  signingUp: string
  nameRequired: string
  emailRequired: string
  passwordRequired: string
  invitationSignUpRequiresHandler: string
  couldNotCreateAccount: string
  somethingWentWrong: string
  or: string
  haveAccount: string
  signIn: string
}

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

export const defaultSignUpPageMessages: SignUpPageMessages = {
  title: "Create account",
  description: "Set up your operator account to continue.",
  nameLabel: "Full name",
  namePlaceholder: "Ana Voyant",
  emailLabel: "Email",
  emailPlaceholder: "ana@example.com",
  passwordLabel: "Password",
  invitationTokenLabel: "Invitation token",
  invitationTokenPlaceholder: "Paste your invitation token",
  submit: "Create account",
  signingUp: "Creating account",
  nameRequired: "Full name is required.",
  emailRequired: "Email is required.",
  passwordRequired: "Password is required.",
  invitationSignUpRequiresHandler: "Invitation sign-ups must be handled by the host app.",
  couldNotCreateAccount: "Could not create account.",
  somethingWentWrong: "Something went wrong. Try again.",
  or: "Or",
  haveAccount: "Already have an account?",
  signIn: "Sign in",
}

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
  const messages = { ...defaultSignUpPageMessages, ...messageOverrides }
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
    <div
      data-slot="sign-up-page"
      className={cn("mx-auto flex w-full max-w-sm flex-col gap-6", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

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
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {isSubmitting ? messages.signingUp : messages.submit}
        </Button>
      </form>

      {hasSocialProviders && (
        <>
          <div className="flex items-center gap-3">
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
        <p className="text-center text-sm text-muted-foreground">
          {messages.haveAccount}{" "}
          <a href={signInHref} className="font-medium text-primary hover:underline">
            {messages.signIn}
          </a>
        </p>
      )}
    </div>
  )
}
