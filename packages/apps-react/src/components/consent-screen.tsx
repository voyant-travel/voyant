"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { formatApiKeyPermissionLabel } from "@voyant-travel/types/api-keys"
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useApp, useAppReleases, useApps } from "../hooks/use-apps.js"
import { useInstallationActions } from "../hooks/use-installation-actions.js"
import { useMarketplaceInstallIntent } from "../hooks/use-marketplace-install-intent.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import type { AppReleaseRecord } from "../schemas.js"
import { ConsentDisclosures, readConsentDisclosures } from "./consent-disclosures.js"

const UPDATE_POLICIES = ["compatible", "patch", "manual", "pinned"] as const

export interface ConsentScreenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actorId: string
  /** Pre-select an app (e.g. reinstalling from its detail page). */
  appId?: string
  /** Opaque host-issued Marketplace intent. No app coordinates are read from the URL. */
  installIntent?: string
  onInstalled?: (installationId: string) => void
}

export function ConsentScreen({
  open,
  onOpenChange,
  actorId,
  appId: initialAppId,
  installIntent,
  onInstalled,
}: ConsentScreenProps) {
  const { messages } = useAppsUiI18nOrDefault()
  const t = messages.consent
  const apps = useApps({ limit: 100 })
  const [appId, setAppId] = useState<string | undefined>(initialAppId)
  const [releaseId, setReleaseId] = useState<string | undefined>()
  const [denied, setDenied] = useState<Set<string>>(new Set())
  const [updatePolicy, setUpdatePolicy] = useState<(typeof UPDATE_POLICIES)[number]>("compatible")
  const app = useApp(appId)
  const releases = useAppReleases(appId)
  const { install } = useInstallationActions()
  const marketplace = useMarketplaceInstallIntent()
  const resolvedIntent = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !installIntent || resolvedIntent.current === installIntent) return
    resolvedIntent.current = installIntent
    marketplace.resolveIntent.mutate(installIntent, {
      onSuccess: (result) => {
        setAppId(result.appId)
        setReleaseId(result.releaseId)
      },
    })
  }, [installIntent, open, marketplace.resolveIntent.mutate])

  const selectedApp = app.data?.data
  const release: AppReleaseRecord | undefined = releases.data?.data.find(
    (candidate) => candidate.id === releaseId,
  )
  const disclosure = useMemo(
    () => (release ? readConsentDisclosures(release.normalizedRecord) : null),
    [release],
  )
  const required = disclosure?.requestedScopes ?? []
  const optional = disclosure?.optionalScopes ?? []

  const grantedOptional = optional.filter((scope) => !denied.has(scope))
  const grantedCount = required.length + grantedOptional.length

  const toggleOptional = (scope: string, granted: boolean) => {
    setDenied((current) => {
      const next = new Set(current)
      if (granted) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  const reset = () => {
    setDenied(new Set())
    setReleaseId(undefined)
    install.reset()
    marketplace.resolveIntent.reset()
    marketplace.createSetupHandoff.reset()
    resolvedIntent.current = null
  }

  const handleApprove = async () => {
    if (!appId || !releaseId) return
    const result = await install.mutateAsync({
      appId,
      releaseId,
      actorId,
      grantedOptionalScopes: grantedOptional,
      updatePolicy,
    })
    onInstalled?.(result.installation.id)
    if ((installIntent || selectedApp?.distribution === "marketplace") && disclosure?.urls.setup) {
      try {
        const handoff = await marketplace.createSetupHandoff.mutateAsync(result.installation.id)
        if (typeof window !== "undefined") window.location.assign(handoff.redirectUrl)
        return
      } catch {
        return
      }
    }
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {selectedApp
              ? formatMessage(t.description, { name: selectedApp.displayName })
              : messages.list.description}
          </DialogDescription>
        </DialogHeader>

        {installIntent ? (
          <ManagedInstallIdentity
            appName={selectedApp?.displayName}
            releaseVersion={release?.releaseVersion}
            messages={t}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.selectApp}</Label>
              <Select
                value={appId}
                onValueChange={(value) => {
                  setAppId(value ?? undefined)
                  setReleaseId(undefined)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectApp} />
                </SelectTrigger>
                <SelectContent>
                  {(apps.data?.data ?? []).map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.selectRelease}</Label>
              <Select
                value={releaseId}
                onValueChange={(value) => setReleaseId(value ?? undefined)}
                disabled={!appId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectRelease} />
                </SelectTrigger>
                <SelectContent>
                  {(releases.data?.data ?? [])
                    .filter((candidate) => candidate.state === "available")
                    .map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.releaseVersion}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {marketplace.resolveIntent.isPending ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-4 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t.resolvingIntent}
          </div>
        ) : null}

        {release ? (
          <div className="space-y-5">
            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">{t.requiredHeading}</h3>
                <p className="text-xs text-muted-foreground">{t.requiredHelp}</p>
              </div>
              <div className="flex flex-col gap-2">
                {required.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{messages.detail.noScopes}</p>
                ) : (
                  required.map((scope) => (
                    <div
                      key={scope}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <ScopeLabel scope={scope} />
                      <Badge>{messages.detail.grantedBadge}</Badge>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">{t.optionalHeading}</h3>
                <p className="text-xs text-muted-foreground">{t.optionalHelp}</p>
              </div>
              {optional.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noOptional}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {optional.map((scope) => {
                    const granted = !denied.has(scope)
                    return (
                      <div
                        key={scope}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <ScopeLabel scope={scope} />
                        <span className="flex items-center gap-2">
                          <Badge variant={granted ? "outline" : "secondary"}>
                            {granted ? messages.detail.optionalBadge : messages.detail.deniedBadge}
                          </Badge>
                          <Checkbox
                            aria-label={scope}
                            checked={granted}
                            onCheckedChange={(checked) => toggleOptional(scope, checked === true)}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t.installPolicy}
                </Label>
                <Select
                  value={updatePolicy}
                  onValueChange={(value) => {
                    if (value) setUpdatePolicy(value as (typeof UPDATE_POLICIES)[number])
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPDATE_POLICIES.map((policy) => (
                      <SelectItem key={policy} value={policy}>
                        {policy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto text-right text-sm">
                <p className="font-medium">
                  {formatMessage(t.grantSummary, { count: grantedCount })}
                </p>
                {denied.size > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatMessage(t.deniedSummary, { count: denied.size })}
                  </p>
                ) : null}
              </div>
            </div>

            {disclosure ? <ConsentDisclosures disclosure={disclosure} messages={messages} /> : null}
          </div>
        ) : null}

        {release && !disclosure ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{messages.common.loadFailed}</AlertDescription>
          </Alert>
        ) : null}

        {install.isError || marketplace.resolveIntent.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {(install.error ?? marketplace.resolveIntent.error) instanceof Error
                ? (install.error ?? marketplace.resolveIntent.error)?.message
                : messages.common.requestFailed}
            </AlertDescription>
          </Alert>
        ) : null}

        {marketplace.createSetupHandoff.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{t.setupFailed}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={install.isPending}
          >
            {messages.common.cancel}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={
              !releaseId ||
              !disclosure ||
              install.isPending ||
              marketplace.resolveIntent.isPending ||
              marketplace.createSetupHandoff.isPending
            }
          >
            {install.isPending || marketplace.createSetupHandoff.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {install.isPending || marketplace.createSetupHandoff.isPending
              ? t.approving
              : t.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const formatScopeLabel = formatApiKeyPermissionLabel

export function ScopeLabel({ scope }: { scope: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-sm font-medium">{formatScopeLabel(scope)}</span>
      <span className="font-mono text-xs text-muted-foreground">{scope}</span>
    </span>
  )
}

function ManagedInstallIdentity({
  appName,
  releaseVersion,
  messages,
}: {
  appName?: string
  releaseVersion?: string
  messages: ReturnType<typeof useAppsUiI18nOrDefault>["messages"]["consent"]
}) {
  return (
    <div
      className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2"
      data-slot="managed-app-verified-identity"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {messages.verifiedApp}
        </p>
        <p className="font-semibold">{appName ?? messages.verifyingIdentity}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {messages.verifiedVersion}
        </p>
        <p className="font-mono text-sm">{releaseVersion ?? messages.verifyingIdentity}</p>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        <ShieldCheck className="mr-1 inline size-3.5" />
        {messages.verifiedMarketplaceIdentity}
      </p>
    </div>
  )
}
