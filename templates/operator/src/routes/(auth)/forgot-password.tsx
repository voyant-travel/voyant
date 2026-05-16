import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/admin"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/forgot-password")({
  loader: async ({ location }) => {
    const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

    if (user) {
      throw redirect({ to: "/" })
    }

    if (bootstrap.authMode === "voyant-cloud") {
      throw redirect({ href: cloudAuthStartHref(location.href) })
    }

    return null
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const messages = useAdminMessages().auth.forgotPassword
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })

      if (result.error) {
        setError(result.error.message || messages.couldNotSendResetEmail)
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError(messages.somethingWentWrong)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle>{messages.checkEmailTitle}</CardTitle>
          <CardDescription>
            {formatMessage(messages.checkEmailDescription, { email })}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            {messages.backToSignIn}
          </Link>
        </CardFooter>
      </Card>
    )
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
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.submit}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link to="/sign-in" className="text-sm text-muted-foreground hover:underline">
          {messages.backToSignIn}
        </Link>
      </CardFooter>
    </Card>
  )
}
