"use client"

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@voyant-travel/ui/components"
import { AlertCircle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react"
import { useState } from "react"
import { useInstallationActions } from "../hooks/use-installation-actions.js"
import { useInstallation } from "../hooks/use-installations.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import type { AppsUiMessages } from "../i18n/messages.js"
import type {
  AppAuditEventRecord,
  AppAvailableUpdate,
  AppGrantRecord,
  AppInstallationDetail,
  AppPurgePreview,
} from "../schemas.js"
import { PurgeDialog, UninstallDialog } from "./installation-dialogs.js"
import { formatWhen, MonoText, SectionEmpty, StatusBadge } from "./shared.js"

export interface InstallationDetailProps {
  installationId: string
  actorId: string
  onBack?: () => void
  /** Base path of the operator custom-fields Settings surface. */
  customFieldsHref?: string
}

export function InstallationDetail({
  installationId,
  actorId,
  onBack,
  customFieldsHref = "/settings/custom-fields",
}: InstallationDetailProps) {
  const { messages } = useAppsUiI18nOrDefault()
  const query = useInstallation(installationId)

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          {messages.common.loadFailed}{" "}
          {query.error instanceof Error ? query.error.message : messages.common.requestFailed}
        </AlertDescription>
      </Alert>
    )
  }
  if (query.isPending || !query.data) {
    return <div className="h-64 animate-pulse rounded-md border bg-muted/40" />
  }

  return (
    <DetailView
      detail={query.data.data}
      actorId={actorId}
      messages={messages}
      onBack={onBack}
      customFieldsHref={customFieldsHref}
    />
  )
}

function DetailView({
  detail,
  actorId,
  messages,
  onBack,
  customFieldsHref,
}: {
  detail: AppInstallationDetail
  actorId: string
  messages: AppsUiMessages
  onBack?: () => void
  customFieldsHref: string
}) {
  const t = messages.detail
  const { formatDateTime } = useAppsUiI18nOrDefault()
  const { installation, app, activeRelease, pendingRelease } = detail
  const actions = useInstallationActions()
  const [confirm, setConfirm] = useState<"uninstall" | "purge" | null>(null)
  const [preview, setPreview] = useState<AppPurgePreview | null>(null)

  const busy =
    actions.pause.isPending ||
    actions.resume.isPending ||
    actions.uninstall.isPending ||
    actions.activate.isPending
  const installationId = installation.id
  const namespaceHref = `${customFieldsHref}?namespace=${encodeURIComponent(installation.namespace)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {onBack ? (
            <Button variant="ghost" size="icon" className="mt-0.5" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{app.displayName}</h2>
              <StatusBadge status={installation.status} messages={messages} />
              <Badge variant="outline">
                {app.distribution === "custom" ? messages.list.custom : messages.list.marketplace}
              </Badge>
            </div>
            <MonoText className="text-muted-foreground">{installation.namespace}</MonoText>
          </div>
        </div>
        <LifecycleActions
          status={installation.status}
          busy={busy}
          messages={messages}
          onPause={() => actions.pause.mutate({ installationId, actorId })}
          onResume={() => actions.resume.mutate({ installationId, actorId })}
          onUninstall={() => setConfirm("uninstall")}
          onPurge={() => setConfirm("purge")}
        />
      </div>

      {pendingRelease ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t.pendingRelease}: {pendingRelease.releaseVersion}
            {installation.pendingReason ? ` — ${installation.pendingReason}` : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t.overview}</TabsTrigger>
          <TabsTrigger value="scopes">{t.scopes}</TabsTrigger>
          <TabsTrigger value="extensions">{t.extensions}</TabsTrigger>
          <TabsTrigger value="webhooks">{t.webhooks}</TabsTrigger>
          <TabsTrigger value="audit">{t.audit}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t.overview}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label={t.activeRelease} value={activeRelease?.releaseVersion ?? "—"} />
                <Row label={t.updatePolicy} value={installation.updatePolicy} />
                <Row label={t.namespace} mono value={installation.namespace} />
                <Row label={t.installedBy} mono value={installation.installedBy} />
                <Row
                  label={t.installedAt}
                  value={formatWhen(installation.installedAt, formatDateTime)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t.fieldDefinitions}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{t.fieldDefinitionsDescription}</p>
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  href={namespaceHref}
                >
                  {t.viewDefinitions}
                  <ExternalLink className="size-3.5" />
                </a>
              </CardContent>
            </Card>
          </div>
          <AvailableUpdates
            updates={detail.availableUpdates}
            messages={messages}
            busy={actions.activate.isPending}
            onActivate={(releaseId) =>
              actions.activate.mutate({ installationId, releaseId, actorId })
            }
          />
        </TabsContent>

        <TabsContent value="scopes">
          <ScopesPanel grants={detail.grants} messages={messages} />
        </TabsContent>

        <TabsContent value="extensions">
          <Card>
            <CardContent className="p-0">
              {detail.extensions.length === 0 ? (
                <SectionEmpty>{t.noExtensions}</SectionEmpty>
              ) : (
                <ul className="divide-y">
                  {detail.extensions.map((extension) => (
                    <li
                      key={extension.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <MonoText>{extension.extensionKey}</MonoText>
                      <Badge variant={extension.status === "active" ? "default" : "secondary"}>
                        {extension.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardContent className="p-0">
              {detail.webhooks.data.length === 0 ? (
                <SectionEmpty>{t.noWebhooks}</SectionEmpty>
              ) : (
                <ul className="divide-y">
                  {detail.webhooks.data.map((webhook) => (
                    <li key={webhook.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <MonoText>
                          {webhook.eventType}@{webhook.eventVersion}
                        </MonoText>
                        <Badge
                          variant={
                            webhook.status === "active"
                              ? "default"
                              : webhook.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {webhook.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                        <span className="truncate">{webhook.endpointUrl}</span>
                        <span>
                          {t.webhookFailures}: {webhook.failureCount}
                        </span>
                        <span>
                          {t.webhookLastDelivery}:{" "}
                          {formatWhen(webhook.lastDeliveryAt, formatDateTime)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              {detail.recentAudit.length === 0 ? (
                <SectionEmpty>{t.noAudit}</SectionEmpty>
              ) : (
                <ul className="divide-y">
                  {detail.recentAudit.map((event) => (
                    <AuditRow key={event.id} event={event} formatDateTime={formatDateTime} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UninstallDialog
        open={confirm === "uninstall"}
        appName={app.displayName}
        messages={messages}
        pending={actions.uninstall.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await actions.uninstall.mutateAsync({ installationId, actorId })
          setConfirm(null)
        }}
      />
      <PurgeDialog
        open={confirm === "purge"}
        appName={app.displayName}
        messages={messages}
        preview={preview}
        loadingPreview={actions.purgePreview.isPending}
        onLoadPreview={async () => {
          const result = await actions.purgePreview.mutateAsync({ installationId, actorId })
          setPreview(result)
        }}
        onCancel={() => {
          setPreview(null)
          setConfirm(null)
        }}
      />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {mono ? <MonoText>{value}</MonoText> : <span className="text-right">{value}</span>}
    </div>
  )
}

function LifecycleActions({
  status,
  busy,
  messages,
  onPause,
  onResume,
  onUninstall,
  onPurge,
}: {
  status: AppInstallationDetail["installation"]["status"]
  busy: boolean
  messages: AppsUiMessages
  onPause: () => void
  onResume: () => void
  onUninstall: () => void
  onPurge: () => void
}) {
  const t = messages.detail
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" || status === "degraded" ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onPause}>
          {t.pause}
        </Button>
      ) : null}
      {status === "paused" ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onResume}>
          {t.resume}
        </Button>
      ) : null}
      {["active", "paused", "degraded"].includes(status) ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onUninstall}>
          {t.uninstall}
        </Button>
      ) : null}
      {status === "uninstalled" ? (
        <Button variant="destructive" size="sm" onClick={onPurge}>
          {t.purge}
        </Button>
      ) : null}
    </div>
  )
}

function ScopesPanel({ grants, messages }: { grants: AppGrantRecord[]; messages: AppsUiMessages }) {
  const t = messages.detail
  const granted = grants.filter((grant) => grant.status === "granted")
  const optional = grants.filter((grant) => grant.status === "optional")
  const revoked = grants.filter((grant) => grant.status === "revoked")
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ScopeColumn title={t.grantedScopes} scopes={granted} empty={t.noScopes} variant="default" />
      <ScopeColumn
        title={t.optionalScopes}
        scopes={optional}
        empty={t.noScopes}
        variant="outline"
      />
      <ScopeColumn
        title={t.revokedScopes}
        scopes={revoked}
        empty={t.noScopes}
        variant="secondary"
      />
    </div>
  )
}

function ScopeColumn({
  title,
  scopes,
  empty,
  variant,
}: {
  title: string
  scopes: AppGrantRecord[]
  empty: string
  variant: "default" | "outline" | "secondary"
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {title} <span className="text-muted-foreground">({scopes.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {scopes.length === 0 ? (
          <span className="text-xs text-muted-foreground">{empty}</span>
        ) : (
          scopes.map((grant) => (
            <Badge key={grant.id} variant={variant} className="font-mono">
              {grant.scope}
            </Badge>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function AvailableUpdates({
  updates,
  messages,
  busy,
  onActivate,
}: {
  updates: AppAvailableUpdate[]
  messages: AppsUiMessages
  busy: boolean
  onActivate: (releaseId: string) => void
}) {
  const t = messages.detail
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t.availableUpdates}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {updates.length === 0 ? (
          <SectionEmpty>{t.noUpdates}</SectionEmpty>
        ) : (
          <ul className="divide-y">
            {updates.map((update) => (
              <li
                key={update.release.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <MonoText>{update.release.releaseVersion}</MonoText>
                  {update.blocked ? <Badge variant="destructive">{t.blockedReason}</Badge> : null}
                </div>
                {update.blocked ? (
                  <span className="max-w-md text-xs text-muted-foreground">
                    {update.blockedReason}
                  </span>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => onActivate(update.release.id)}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t.activate}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AuditRow({
  event,
  formatDateTime,
}: {
  event: AppAuditEventRecord
  formatDateTime: ReturnType<typeof useAppsUiI18nOrDefault>["formatDateTime"]
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{event.kind}</Badge>
        <MonoText>{event.action}</MonoText>
      </div>
      <span className="text-xs text-muted-foreground">
        {formatWhen(event.createdAt, formatDateTime)}
      </span>
    </li>
  )
}
