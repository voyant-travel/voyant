import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
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
import { useEffect, useState } from "react"

import { getCurrentUser } from "@/lib/current-user"
import { getCurrentWorkspace } from "@/lib/current-workspace"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(auth)/onboarding")({
  loader: async ({ location }) => {
    const [user, workspace] = await Promise.all([getCurrentUser(), getCurrentWorkspace()])

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { next: location.href },
      })
    }

    if (workspace?.activeOrganization) {
      throw redirect({ to: "/" })
    }

    return { user }
  },
  component: OnboardingPage,
})

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = Route.useLoaderData()

  const [companyName, setCompanyName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [contactEmail, setContactEmail] = useState(user.email)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-derive slug from company name (unless user has manually edited it)
  useEffect(() => {
    if (!slugEdited) {
      setSlug(toSlug(companyName))
    }
  }, [companyName, slugEdited])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const apiUrl = getApiUrl()
      const res = await fetch(`${apiUrl}/auth/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: companyName, slug, contactEmail }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
          details?: unknown
        } | null
        setError(body?.error ?? "Failed to create organization")
        setLoading(false)
        return
      }

      void navigate({ to: "/" })
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your organization</CardTitle>
        <CardDescription>Create your company workspace and first operator</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Acme Tours"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              type="text"
              placeholder="acme-tours"
              value={slug}
              onChange={(e) => {
                setSlug(toSlug(e.target.value))
                setSlugEdited(true)
              }}
              required
              minLength={2}
              maxLength={63}
              pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="you@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !companyName || !slug}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create organization
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
