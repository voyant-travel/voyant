import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { authClient } from "@/lib/auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/accept-invitation")({
  validateSearch: z.object({
    id: z.string(),
  }),
  loader: async ({ location }) => {
    const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

    if (bootstrap.authMode === "voyant-cloud") {
      throw redirect({ href: cloudAuthStartHref(location.href) })
    }

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { next: location.href },
      })
    }

    return { user }
  },
  component: AcceptInvitationPage,
})

function AcceptInvitationPage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const handleAccept = async () => {
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.organization.acceptInvitation({ invitationId: id })

      if (result.error) {
        setError(result.error.message || "Failed to accept invitation")
        setLoading(false)
        return
      }

      setAccepted(true)
      // Short delay to show success, then redirect
      setTimeout(() => navigate({ to: "/" }), 1500)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (accepted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation accepted</CardTitle>
          <CardDescription>Redirecting to your dashboard...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>You have been invited to join an organization on Voyant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        <Button onClick={handleAccept} className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept invitation
        </Button>
      </CardContent>
    </Card>
  )
}
