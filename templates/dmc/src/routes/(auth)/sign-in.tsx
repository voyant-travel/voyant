import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
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
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "@/lib/current-user"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(auth)/sign-in")({
  loader: async ({ location }) => {
    const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

    if (user) {
      throw redirect({ to: "/" })
    }

    if (bootstrap.authMode === "voyant-cloud") {
      throw redirect({ href: cloudAuthStartHref(location.href) })
    }

    if (!bootstrap.hasUsers) {
      throw redirect({ to: "/sign-up" })
    }

    return null
  },
  validateSearch: z.object({
    next: z.string().optional(),
    redirect_url: z.string().optional(),
    reset: z.string().optional(),
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const { next, redirect_url } = Route.useSearch()
  const redirectTo = next || redirect_url || "/"
  const messages = useAdminMessages().auth.signIn

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resending, setResending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailNotVerified(false)
    setLoading(true)

    try {
      const result = await authClient.signIn.email({ email, password })

      if (result.error) {
        const msg = result.error.message ?? ""
        if (msg.toLowerCase().includes("not verified") || result.error.status === 403) {
          setEmailNotVerified(true)
          setError(messages.emailNotVerified)
        } else {
          setError(msg || messages.invalidEmailOrPassword)
        }
        setLoading(false)
        return
      }

      // Provision identity if needed
      await fetch(`${getApiUrl()}/auth/status`, { credentials: "include" })

      void navigate({ to: redirectTo })
    } catch {
      setError(messages.somethingWentWrong)
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setResending(true)
    setError(null)

    try {
      await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
      void navigate({ to: "/verify-email", search: { email } })
    } catch {
      setError(messages.somethingWentWrong)
      setResending(false)
    }
  }

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              {emailNotVerified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="mt-2 font-medium underline hover:no-underline disabled:opacity-50"
                >
                  {resending ? messages.sending : messages.resendVerificationCode}
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{messages.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder={messages.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{messages.passwordLabel}</Label>
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:underline">
                {messages.forgotPassword}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.submit}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted-foreground">{messages.or}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} type="button">
          <svg aria-hidden="true" className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {messages.continueWithGoogle}
        </Button>
      </CardContent>
    </Card>
  )
}
