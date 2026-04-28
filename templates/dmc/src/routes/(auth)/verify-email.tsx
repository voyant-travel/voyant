import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@voyantjs/ui/components"
import { formatMessage } from "@voyantjs/voyant-admin"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { getCurrentUser } from "@/lib/current-user"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(auth)/verify-email")({
  loader: async () => {
    const user = await getCurrentUser()

    if (user) {
      throw redirect({ to: "/" })
    }

    return null
  },
  validateSearch: z.object({
    email: z.string(),
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { email } = Route.useSearch()
  const messages = useAdminMessages().auth.verifyEmail

  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp })

      if (result.error) {
        setError(result.error.message || messages.invalidVerificationCode)
        setLoading(false)
        return
      }

      // Provision identity
      await fetch(`${getApiUrl()}/auth/status`, { credentials: "include" })

      void navigate({ to: "/" })
    } catch {
      setError(messages.somethingWentWrong)
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    setError(null)

    try {
      await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
      setResent(true)
    } catch {
      setError(messages.resendFailed)
    } finally {
      setResending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{formatMessage(messages.description, { email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {resent && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              {messages.resent}
            </div>
          )}
          <div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.submit}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
          >
            {resending ? messages.sending : messages.resendCode}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
