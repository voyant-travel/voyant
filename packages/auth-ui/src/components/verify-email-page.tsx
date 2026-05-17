"use client"

import { useVerifyEmail, type VerifyEmailInput, type VerifyEmailResult } from "@voyantjs/auth-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
} from "@voyantjs/ui/components"
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { authUiEn } from "../i18n/en.js"
import type { VerifyEmailPageMessages } from "../i18n/messages.js"
import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"

export type VerifyEmailPageMode = "otp" | "token"

export type { VerifyEmailPageMessages } from "../i18n/messages.js"

export interface VerifyEmailPageProps {
  className?: string
  messages?: Partial<VerifyEmailPageMessages>
  mode?: VerifyEmailPageMode
  email?: string
  token?: string
  code?: string
  codeLength?: number
  autoSubmitToken?: boolean
  signInHref?: string
  changeEmailHref?: string
  onCompleted?: (options: {
    input: VerifyEmailInput
    result: VerifyEmailResult
  }) => Promise<void> | void
  onResendVerification?: (email: string) => Promise<void> | void
  onSignInClick?: () => Promise<void> | void
  onChangeEmailClick?: () => Promise<void> | void
}

export const defaultVerifyEmailPageMessages = authUiEn.verifyEmailPage

function verificationErrorMessage(error: unknown, messages: VerifyEmailPageMessages): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return messages.invalidVerification
}

function mergeMessages(
  defaults: VerifyEmailPageMessages,
  overrides?: Partial<VerifyEmailPageMessages>,
): VerifyEmailPageMessages {
  return { ...defaults, ...overrides }
}

export function VerifyEmailPage({
  className,
  messages: messageOverrides,
  mode,
  email,
  token,
  code,
  codeLength = 6,
  autoSubmitToken = true,
  signInHref,
  changeEmailHref,
  onCompleted,
  onResendVerification,
  onSignInClick,
  onChangeEmailClick,
}: VerifyEmailPageProps) {
  const defaultMessages = useAuthUiMessagesOrDefault().verifyEmailPage
  const messages = useMemo(
    () => mergeMessages(defaultMessages, messageOverrides),
    [defaultMessages, messageOverrides],
  )
  const verifyEmailMutation = useVerifyEmail()
  const selectedMode: VerifyEmailPageMode = mode ?? (token ? "token" : "otp")
  const autoSubmittedTokenRef = useRef<string | null>(null)
  const codeSlots = useMemo(
    () =>
      Array.from({ length: codeLength }, (_, index) => ({
        id: `verify-email-code-slot-${index}`,
        index,
      })),
    [codeLength],
  )

  const [emailValue, setEmailValue] = useState(email ?? "")
  const [codeValue, setCodeValue] = useState(code ?? "")
  const [tokenValue, setTokenValue] = useState(token ?? "")
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)

  const isSubmitting = verifyEmailMutation.isPending
  const canResend = Boolean(onResendVerification)

  const submitVerification = useCallback(
    async (input: VerifyEmailInput) => {
      setError(null)
      setResent(false)

      try {
        const result = await verifyEmailMutation.mutateAsync(input)
        setVerified(true)
        await onCompleted?.({ input, result })
      } catch (err) {
        setVerified(false)
        setError(verificationErrorMessage(err, messages))
      }
    },
    [messages, onCompleted, verifyEmailMutation.mutateAsync],
  )

  useEffect(() => {
    if (
      selectedMode !== "token" ||
      !autoSubmitToken ||
      !token ||
      autoSubmittedTokenRef.current === token
    ) {
      return
    }

    autoSubmittedTokenRef.current = token
    void submitVerification({ token })
  }, [autoSubmitToken, selectedMode, submitVerification, token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (selectedMode === "token") {
      const trimmedToken = tokenValue.trim()
      if (!trimmedToken) {
        setError(messages.tokenRequired)
        return
      }

      await submitVerification({ token: trimmedToken })
      return
    }

    const trimmedEmail = emailValue.trim()
    const trimmedCode = codeValue.trim()

    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    if (!trimmedCode) {
      setError(messages.codeRequired)
      return
    }

    await submitVerification({ email: trimmedEmail, otp: trimmedCode })
  }

  const handleResend = async () => {
    if (!onResendVerification) {
      return
    }

    const trimmedEmail = emailValue.trim()
    if (!trimmedEmail) {
      setError(messages.emailRequired)
      return
    }

    setResending(true)
    setResent(false)
    setError(null)

    try {
      await onResendVerification(trimmedEmail)
      setResent(true)
    } catch {
      setError(messages.resendFailed)
    } finally {
      setResending(false)
    }
  }

  if (verified) {
    return (
      <Card data-slot="verify-email-page" className={cn(className)}>
        <CardHeader>
          <CheckCircle2 className="mb-2 h-8 w-8 text-green-600" aria-hidden="true" />
          <CardTitle>{messages.successTitle}</CardTitle>
          <CardDescription>{messages.successDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {signInHref ? (
            <a
              href={signInHref}
              onClick={() => void onSignInClick?.()}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              {messages.signIn}
            </a>
          ) : (
            onSignInClick && (
              <Button type="button" className="w-full" onClick={() => void onSignInClick()}>
                {messages.signIn}
              </Button>
            )
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-slot="verify-email-page" className={cn(className)}>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>
          {selectedMode === "token" ? messages.tokenDescription : messages.description}
        </CardDescription>
        {selectedMode === "otp" && emailValue && (
          <p className="text-sm font-medium">{emailValue}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {resent && (
            <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              {messages.resent}
            </div>
          )}

          {selectedMode === "otp" && !email && (
            <div className="space-y-2">
              <Label htmlFor="auth-verify-email-address">{messages.emailLabel}</Label>
              <Input
                id="auth-verify-email-address"
                type="email"
                placeholder={messages.emailPlaceholder}
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          )}

          {selectedMode === "otp" && (
            <div className="space-y-2">
              <Label htmlFor="auth-verify-email-code">{messages.codeLabel}</Label>
              <div className="flex justify-center sm:justify-start">
                <InputOTP
                  id="auth-verify-email-code"
                  maxLength={codeLength}
                  value={codeValue}
                  onChange={setCodeValue}
                  disabled={isSubmitting}
                  autoFocus={Boolean(email)}
                >
                  <InputOTPGroup>
                    {codeSlots.map((slot) => (
                      <InputOTPSlot
                        key={slot.id}
                        index={slot.index}
                        className="h-12 w-12 text-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          {selectedMode === "token" && (
            <div className="space-y-2">
              <Label htmlFor="auth-verify-email-token">{messages.tokenLabel}</Label>
              <Input
                id="auth-verify-email-token"
                value={tokenValue}
                onChange={(event) => setTokenValue(event.target.value)}
                placeholder={messages.tokenPlaceholder}
                disabled={isSubmitting}
                required
                autoFocus={!tokenValue}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              (selectedMode === "otp" && codeValue.trim().length !== codeLength) ||
              (selectedMode === "token" && tokenValue.trim().length === 0)
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? messages.verifying : messages.submit}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-3 text-center text-sm">
          {canResend && (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending || isSubmitting}
              className="inline-flex items-center gap-2 font-medium text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
            >
              {resending && <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {resending ? messages.sending : messages.resendCode}
            </button>
          )}

          {changeEmailHref ? (
            <a
              href={changeEmailHref}
              onClick={() => void onChangeEmailClick?.()}
              className="text-muted-foreground hover:text-primary hover:underline"
            >
              {messages.changeEmail}
            </a>
          ) : (
            onChangeEmailClick && (
              <button
                type="button"
                onClick={() => void onChangeEmailClick()}
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                {messages.changeEmail}
              </button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}
