import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@voyantjs/ui/components"
import { formatMessage, useLocale } from "@voyantjs/voyant-admin"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/providers/user-provider"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"

function getErrorMessage(error: { message?: string | null } | null | undefined, fallback: string) {
  const message = error?.message?.trim()
  return message && message.length > 0 ? message : fallback
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

export function AccountPage() {
  const messages = useAdminMessages().accountPage
  const chromeMessages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const { user, refetch } = useUser()

  const [newEmail, setNewEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const fullName = useMemo(() => {
    if (!user) return messages.noValue

    const value = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
    return value || messages.noValue
  }, [messages.noValue, user])

  if (!user) {
    return null
  }

  const localeLabel = resolvedLocale === "ro" ? chromeMessages.romanian : chromeMessages.english

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setEmailError(null)
    setSendingCode(true)

    try {
      const result = await authClient.emailOtp.requestEmailChange({
        newEmail,
      })

      if (result.error) {
        setEmailError(getErrorMessage(result.error, messages.genericError))
        return
      }

      const normalizedEmail = newEmail.trim()
      setCodeSentTo(normalizedEmail)
      setVerificationCode("")
      toast.success(formatMessage(messages.codeSentDescription, { email: normalizedEmail }))
    } catch {
      setEmailError(messages.genericError)
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!codeSentTo) return

    setEmailError(null)
    setVerifyingEmail(true)

    try {
      const result = await authClient.emailOtp.changeEmail({
        newEmail: codeSentTo,
        otp: verificationCode,
      })

      if (result.error) {
        setEmailError(getErrorMessage(result.error, messages.genericError))
        return
      }

      setNewEmail("")
      setVerificationCode("")
      setCodeSentTo(null)
      await refetch()
      toast.success(messages.emailChangeSuccess)
    } catch {
      setEmailError(messages.genericError)
    } finally {
      setVerifyingEmail(false)
    }
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError(null)

    if (newPassword.length < 8) {
      setPasswordError(messages.passwordTooShort)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(messages.passwordsDoNotMatch)
      return
    }

    setUpdatingPassword(true)

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      })

      if (result.error) {
        setPasswordError(getErrorMessage(result.error, messages.genericError))
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(messages.passwordChangeSuccess)
    } catch {
      setPasswordError(messages.genericError)
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.profileTitle}</CardTitle>
            <CardDescription>{messages.profileDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <DetailRow label={messages.fullNameLabel} value={fullName} />
              <DetailRow label={messages.emailLabel} value={user.email} />
              <DetailRow label={messages.languageLabel} value={localeLabel} />
              <DetailRow label={messages.timezoneLabel} value={user.timezone || messages.noValue} />
            </dl>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.emailSectionTitle}</CardTitle>
            <CardDescription>{messages.emailSectionDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSendCode} className="space-y-4">
              {emailError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {emailError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="current-email">{messages.currentEmailLabel}</Label>
                <Input id="current-email" value={user.email} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">{messages.newEmailLabel}</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder={messages.newEmailPlaceholder}
                  value={newEmail}
                  onChange={(event) => {
                    const value = event.target.value
                    setNewEmail(value)
                    if (codeSentTo && value.trim().toLowerCase() !== codeSentTo.toLowerCase()) {
                      setCodeSentTo(null)
                      setVerificationCode("")
                    }
                  }}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={sendingCode || newEmail.trim().length === 0}>
                {sendingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sendingCode ? messages.sendingCode : messages.sendCode}
              </Button>
            </form>

            {codeSentTo ? (
              <form onSubmit={handleVerifyEmail} className="space-y-4 border-t pt-6">
                <p className="text-sm text-muted-foreground">
                  {formatMessage(messages.codeSentDescription, { email: codeSentTo })}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-verification-code">{messages.verificationCodeLabel}</Label>
                  <Input
                    id="email-verification-code"
                    inputMode="numeric"
                    placeholder={messages.verificationCodePlaceholder}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={verifyingEmail || verificationCode.trim().length === 0}
                >
                  {verifyingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {verifyingEmail ? messages.verifyingEmailChange : messages.verifyEmailChange}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{messages.passwordSectionTitle}</CardTitle>
          <CardDescription>{messages.passwordSectionDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="grid gap-4 md:grid-cols-3">
            {passwordError ? (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive md:col-span-3">
                {passwordError}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="current-password">{messages.currentPasswordLabel}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{messages.newPasswordLabel}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{messages.confirmPasswordLabel}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={updatingPassword}>
                {updatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {updatingPassword ? messages.updatingPassword : messages.updatePassword}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
