"use client"

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from "@voyant-travel/ui/components"
import { AlertCircle, Copy, KeyRound, Loader2 } from "lucide-react"
import { useState } from "react"
import { useAppMutations } from "../hooks/use-app-mutations.js"
import { useAppReleases } from "../hooks/use-apps.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import type { AppRecord } from "../schemas.js"
import { formatWhen, MonoText, SectionEmpty } from "./shared.js"

export interface ReleaseManagerProps {
  app: AppRecord
  actorId: string
}

export function ReleaseManager({ app, actorId }: ReleaseManagerProps) {
  const i18n = useAppsUiI18nOrDefault()
  const { messages } = i18n
  const t = messages.developer
  const releases = useAppReleases(app.id)
  const { createReleaseFromUpload, createReleaseFromFetch } = useAppMutations()
  const [source, setSource] = useState<"upload" | "fetch">("upload")
  const [manifestJson, setManifestJson] = useState("")
  const [manifestUrl, setManifestUrl] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const mutation = source === "upload" ? createReleaseFromUpload : createReleaseFromFetch
  const installLink =
    typeof window === "undefined"
      ? `/apps?installApp=${app.id}`
      : `${window.location.origin}/apps?installApp=${app.id}`

  const handleCreate = async () => {
    setLocalError(null)
    if (source === "upload") {
      let parsed: unknown
      try {
        parsed = JSON.parse(manifestJson)
      } catch {
        setLocalError(t.invalidJson)
        return
      }
      await createReleaseFromUpload.mutateAsync({
        appId: app.id,
        manifest: parsed,
        createdBy: actorId,
      })
      setManifestJson("")
    } else {
      await createReleaseFromFetch.mutateAsync({
        appId: app.id,
        manifestUrl,
        createdBy: actorId,
      })
      setManifestUrl("")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.credentials}</CardTitle>
          <CardDescription>{t.secretOnce}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <CredentialRow label={t.clientId} value={app.id} copy={messages.common.copy} />
          <CredentialRow
            label={t.namespaceAssigned}
            value={app.platformNamespace}
            copy={messages.common.copy}
          />
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" disabled>
              <KeyRound className="mr-1.5 size-3.5" />
              {t.rotateSecret}
            </Button>
          </div>
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t.installLink}
            </Label>
            <CredentialRow label="" value={installLink} copy={messages.common.copy} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.newRelease}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            className="flex gap-4"
            value={source}
            onValueChange={(value) => setSource(value === "fetch" ? "fetch" : "upload")}
          >
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="upload" id="apps-release-source-upload" />
              <Label htmlFor="apps-release-source-upload">{t.manifestUpload}</Label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="fetch" id="apps-release-source-fetch" />
              <Label htmlFor="apps-release-source-fetch">{t.manifestFetch}</Label>
            </div>
          </RadioGroup>

          {source === "upload" ? (
            <div className="space-y-1.5">
              <Label>{t.manifestJson}</Label>
              <Textarea
                rows={8}
                value={manifestJson}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder={t.manifestJsonPlaceholder}
                onChange={(event) => setManifestJson(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t.manifestUrl}</Label>
              <Input
                value={manifestUrl}
                placeholder={t.manifestUrlPlaceholder}
                onChange={(event) => setManifestUrl(event.target.value)}
              />
            </div>
          )}

          {localError || mutation.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {localError ? (
                  localError
                ) : (
                  <>
                    {t.validationError}{" "}
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : messages.common.requestFailed}
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="sm"
            disabled={
              mutation.isPending ||
              (source === "upload" ? manifestJson.trim() === "" : manifestUrl.trim() === "")
            }
            onClick={handleCreate}
          >
            {mutation.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {mutation.isPending ? t.creatingRelease : t.createRelease}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.releasesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {releases.isPending ? (
            <div className="h-24 animate-pulse bg-muted/40" />
          ) : (releases.data?.data.length ?? 0) === 0 ? (
            <SectionEmpty>{messages.detail.noUpdates}</SectionEmpty>
          ) : (
            <ul className="divide-y">
              {(releases.data?.data ?? []).map((release) => (
                <li
                  key={release.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <MonoText className="text-sm">{release.releaseVersion}</MonoText>
                    <Badge variant={release.state === "available" ? "default" : "secondary"}>
                      {release.state}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <MonoText>{release.manifestDigest.slice(0, 12)}</MonoText>
                    <span>{formatWhen(release.createdAt, i18n.formatDateTime)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CredentialRow({ label, value, copy }: { label: string; value: string; copy: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2">
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="flex min-w-0 items-center gap-2">
        <MonoText className="truncate">{value}</MonoText>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          title={copy}
          onClick={() => {
            void navigator.clipboard?.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Copy className={copied ? "size-3.5 text-primary" : "size-3.5"} />
        </Button>
      </span>
    </div>
  )
}
