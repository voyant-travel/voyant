"use client"

import { useMutation } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { useMemo } from "react"

import { fetchWithValidation } from "../client.js"
import { useApp, useAppReleases } from "../hooks/use-apps.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import { useVoyantContext } from "../provider.js"
import {
  appOAuthAuthorizationRequestSchema,
  appOAuthAuthorizationResponseSchema,
} from "../schemas.js"
import { readConsentDisclosures } from "./consent-disclosures.js"
import { ScopeLabel } from "./consent-screen.js"

export function OAuthAuthorizationPage() {
  const { messages } = useAppsUiI18nOrDefault()
  const { baseUrl, fetcher } = useVoyantContext()
  const request = useMemo(() => readAuthorizationRequest(), [])
  const app = useApp(request?.client_id)
  const releases = useAppReleases(request?.client_id)
  const release = releases.data?.data.find((candidate) => candidate.id === request?.release_id)
  const disclosure = release ? readConsentDisclosures(release.normalizedRecord) : null
  const optional = new Set(splitScopes(request?.optional_scopes ?? ""))
  const scopes = disclosure
    ? [
        ...disclosure.requestedScopes,
        ...disclosure.optionalScopes.filter((scope) => optional.has(scope)),
      ]
    : []

  const authorize = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error(messages.authorization.invalidRequest)
      return fetchWithValidation(
        "/v1/admin/apps/oauth/authorize",
        appOAuthAuthorizationResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(request) },
      )
    },
    onSuccess: (result) => {
      if (typeof window !== "undefined") window.location.assign(result.data.redirectUrl)
    },
  })

  if (!request) {
    return <AuthorizationError message={messages.authorization.invalidRequest} />
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {messages.authorization.title}
          </CardTitle>
          <CardDescription>
            {formatMessage(messages.authorization.description, {
              name: app.data?.data.displayName ?? messages.consent.verifyingIdentity,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
            <div>
              <p className="font-semibold">
                {app.data?.data.displayName ?? messages.consent.verifyingIdentity}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {release?.releaseVersion ?? messages.consent.verifyingIdentity}
              </p>
            </div>
            <Badge variant="outline">{messages.consent.verifiedApp}</Badge>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">{messages.authorization.accessHeading}</h2>
            {scopes.map((scope) => (
              <div key={scope} className="rounded-md border px-3 py-2">
                <ScopeLabel scope={scope} />
              </div>
            ))}
          </section>

          {app.isError || releases.isError || authorize.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{messages.authorization.failed}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => authorize.mutate()}
            disabled={
              !app.data?.data ||
              !release ||
              !disclosure ||
              app.isPending ||
              releases.isPending ||
              authorize.isPending
            }
          >
            {authorize.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {authorize.isPending
              ? messages.authorization.approving
              : messages.authorization.approve}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function readAuthorizationRequest() {
  if (typeof window === "undefined") return null
  const entries = Object.fromEntries(new URLSearchParams(window.location.search))
  const parsed = appOAuthAuthorizationRequestSchema.safeParse(entries)
  return parsed.success ? parsed.data : null
}

function splitScopes(value: string) {
  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function AuthorizationError({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  )
}
