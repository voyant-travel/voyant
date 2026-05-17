"use client"

import { type AcceptInvitationResult, useAcceptInvitation } from "@voyantjs/auth-react"
import { VoyantApiError } from "@voyantjs/auth-react/client"
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
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react"
import { type FormEvent, useEffect, useId, useState } from "react"

import { authUiEn } from "../i18n/en.js"
import type { AcceptInvitationPageMessages } from "../i18n/messages.js"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"

export interface AcceptInvitationHandoffOptions {
  token: string
  invitationId: string
}

export interface AcceptInvitationAcceptedOptions extends AcceptInvitationHandoffOptions {
  result: AcceptInvitationResult
}

export interface AcceptInvitationPageProps {
  className?: string
  messages?: Partial<AcceptInvitationPageMessages>
  token?: string
  defaultToken?: string
  isAuthenticated?: boolean
  signInHref?: string
  signUpHref?: string
  continueHref?: string
  onSignIn?: (options: AcceptInvitationHandoffOptions) => Promise<void> | void
  onSignUp?: (options: AcceptInvitationHandoffOptions) => Promise<void> | void
  onAccepted?: (options: AcceptInvitationAcceptedOptions) => Promise<void> | void
  onContinue?: (options: AcceptInvitationAcceptedOptions) => Promise<void> | void
}

export type { AcceptInvitationPageMessages } from "../i18n/messages.js"

export const defaultAcceptInvitationPageMessages = authUiEn.acceptInvitationPage

function invitationErrorMessage(error: unknown, messages: AcceptInvitationPageMessages): string {
  if (error instanceof VoyantApiError && (error.status === 401 || error.status === 403)) {
    return messages.signInRequired
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return messages.somethingWentWrong
}

export function AcceptInvitationPage({
  className,
  messages: messageOverrides,
  token,
  defaultToken = "",
  isAuthenticated,
  signInHref,
  signUpHref,
  continueHref,
  onSignIn,
  onSignUp,
  onAccepted,
  onContinue,
}: AcceptInvitationPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().acceptInvitationPage
  const messages = { ...defaultMessages, ...messageOverrides }
  const acceptInvitation = useAcceptInvitation()
  const tokenInputId = useId()
  const [tokenValue, setTokenValue] = useState(token ?? defaultToken)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<AcceptInvitationAcceptedOptions | null>(null)
  const [handoffPending, setHandoffPending] = useState<"sign-in" | "sign-up" | null>(null)

  useEffect(() => {
    if (token !== undefined) {
      setTokenValue(token)
    }
  }, [token])

  const currentToken = tokenValue.trim()
  const tokenIsProvided = token !== undefined
  const requiresHandoff = isAuthenticated === false
  const hasSignInAction = Boolean(signInHref || onSignIn)
  const hasSignUpAction = Boolean(signUpHref || onSignUp)
  const hasContinueAction = Boolean(continueHref || onContinue)
  const isSubmitting = acceptInvitation.isPending

  const requireToken = (): string | null => {
    if (!currentToken) {
      setError(messages.tokenRequired)
      return null
    }

    return currentToken
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const invitationToken = requireToken()
    if (!invitationToken || requiresHandoff) {
      return
    }

    try {
      const result = await acceptInvitation.mutateAsync({ token: invitationToken })
      const acceptedOptions = {
        token: invitationToken,
        invitationId: invitationToken,
        result,
      }
      await onAccepted?.(acceptedOptions)
      setAccepted(acceptedOptions)
    } catch (err) {
      setError(invitationErrorMessage(err, messages))
    }
  }

  const handleHandoff = async (kind: "sign-in" | "sign-up") => {
    const invitationToken = requireToken()
    if (!invitationToken) {
      return
    }

    const callback = kind === "sign-in" ? onSignIn : onSignUp
    if (!callback) {
      return
    }

    setError(null)
    setHandoffPending(kind)
    try {
      await callback({ token: invitationToken, invitationId: invitationToken })
    } catch {
      setError(messages.somethingWentWrong)
    } finally {
      setHandoffPending(null)
    }
  }

  const handleContinue = async () => {
    if (!accepted || !onContinue) {
      return
    }

    await onContinue(accepted)
  }

  if (accepted) {
    return (
      <Card data-slot="accept-invitation-page" data-state="success" className={cn(className)}>
        <CardHeader>
          <CheckCircle2 className="mb-2 h-8 w-8 text-primary" aria-hidden="true" />
          <CardTitle>{messages.successTitle}</CardTitle>
          <CardDescription>{messages.successDescription}</CardDescription>
        </CardHeader>
        {hasContinueAction && (
          <CardContent>
            <div className="flex flex-col gap-2">
              {onContinue && (
                <Button type="button" onClick={() => void handleContinue()}>
                  {messages.continue}
                </Button>
              )}
              {continueHref && (
                <a
                  href={continueHref}
                  className="text-center text-sm font-medium text-primary hover:underline"
                >
                  {messages.continue}
                </a>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <Card
      data-slot="accept-invitation-page"
      data-state={requiresHandoff ? "handoff" : error ? "failure" : "idle"}
      className={cn(className)}
    >
      <CardHeader>
        <CardTitle>{requiresHandoff ? messages.handoffTitle : messages.title}</CardTitle>
        <CardDescription>
          {requiresHandoff ? messages.handoffDescription : messages.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">{messages.failureTitle}</p>
                  <p>{error || messages.failureDescription}</p>
                </div>
              </div>
            </div>
          )}

          {!tokenIsProvided && (
            <div className="space-y-2">
              <Label htmlFor={tokenInputId}>{messages.tokenLabel}</Label>
              <Input
                id={tokenInputId}
                type="text"
                placeholder={messages.tokenPlaceholder}
                value={tokenValue}
                onChange={(event) => setTokenValue(event.target.value)}
                required
                autoComplete="off"
                autoFocus
              />
            </div>
          )}

          {requiresHandoff ? (
            <div className="space-y-3">
              {(hasSignInAction || hasSignUpAction) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {onSignIn && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={handoffPending !== null}
                      onClick={() => void handleHandoff("sign-in")}
                    >
                      {handoffPending === "sign-in" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="mr-2 h-4 w-4" />
                      )}
                      {messages.signIn}
                    </Button>
                  )}
                  {onSignUp && (
                    <Button
                      type="button"
                      disabled={handoffPending !== null}
                      onClick={() => void handleHandoff("sign-up")}
                    >
                      {handoffPending === "sign-up" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      {messages.signUp}
                    </Button>
                  )}
                </div>
              )}
              {(signInHref || signUpHref) && (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
                  {signInHref && (
                    <a href={signInHref} className="font-medium text-primary hover:underline">
                      {messages.signIn}
                    </a>
                  )}
                  {signUpHref && (
                    <a href={signUpHref} className="font-medium text-primary hover:underline">
                      {messages.signUp}
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? messages.submitting : messages.submit}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
