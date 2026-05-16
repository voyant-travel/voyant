import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
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
import { z } from "zod"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/reset-password")({
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
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const messages = useAdminMessages().auth.resetPassword

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(messages.passwordsDoNotMatch)
      return
    }

    if (!token) {
      setError(messages.missingResetToken)
      return
    }

    setLoading(true)

    try {
      const result = await authClient.resetPassword({ newPassword: password, token })

      if (result.error) {
        setError(result.error.message || messages.couldNotResetPassword)
        setLoading(false)
        return
      }

      void navigate({ to: "/sign-in", search: { reset: "success" } })
    } catch {
      setError(messages.somethingWentWrong)
      setLoading(false)
    }
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
            <Label htmlFor="password">{messages.newPasswordLabel}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{messages.confirmPasswordLabel}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
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
