"use client"

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { AlertCircle, Loader2, Plus } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useAppMutations } from "../hooks/use-app-mutations.js"
import { useApps } from "../hooks/use-apps.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import type { AppRecord } from "../schemas.js"
import { ReleaseManager } from "./release-manager.js"
import { MonoText } from "./shared.js"

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/

export interface DeveloperAppsPageProps {
  /** Operator user id recorded as `createdBy`/owner default. */
  actorId?: string
  className?: string
}

export function DeveloperAppsPage({
  actorId = "operator",
  className,
}: DeveloperAppsPageProps = {}) {
  const { messages } = useAppsUiI18nOrDefault()
  const t = messages.developer
  const apps = useApps({ distribution: "custom", limit: 100 })
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)

  const list = apps.data?.data ?? []
  const selected = list.find((app) => app.id === selectedId)

  return (
    <div data-slot="developer-apps-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          {t.createApp}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2">
          {apps.isPending ? (
            <div className="h-40 animate-pulse rounded-md border bg-muted/40" />
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
                <p className="text-sm font-medium">{t.emptyApps}</p>
                <p className="max-w-xs text-sm text-muted-foreground">{t.emptyAppsDescription}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      app.id === selectedId ? "border-primary bg-accent" : "bg-card",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {app.displayName}
                      <Badge variant="outline">{messages.list.custom}</Badge>
                    </span>
                    <MonoText className="text-muted-foreground">{app.slug}</MonoText>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {selected ? (
            <ReleaseManager app={selected} actorId={actorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t.selectAppFirst}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreateAppDialog
        open={createOpen}
        actorId={actorId}
        onOpenChange={setCreateOpen}
        onCreated={(app) => {
          setSelectedId(app.id)
          void apps.refetch()
        }}
      />
    </div>
  )
}

function CreateAppDialog({
  open,
  actorId,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  actorId: string
  onOpenChange: (open: boolean) => void
  onCreated: (app: AppRecord) => void
}) {
  const { messages } = useAppsUiI18nOrDefault()
  const t = messages.developer
  const { createApp } = useAppMutations()
  const [displayName, setDisplayName] = useState("")
  const [slug, setSlug] = useState("")
  const [ownerId, setOwnerId] = useState(actorId)
  const [redirectUris, setRedirectUris] = useState("")
  const [validation, setValidation] = useState<string | null>(null)

  const reset = () => {
    setDisplayName("")
    setSlug("")
    setOwnerId(actorId)
    setRedirectUris("")
    setValidation(null)
    createApp.reset()
  }

  const submit = async () => {
    if (displayName.trim() === "") return setValidation(t.nameRequired)
    if (!SLUG_PATTERN.test(slug.trim())) return setValidation(t.slugRequired)
    if (ownerId.trim() === "") return setValidation(t.ownerRequired)
    setValidation(null)
    const app = await createApp.mutateAsync({
      displayName: displayName.trim(),
      slug: slug.trim(),
      ownerId: ownerId.trim(),
      createdBy: actorId,
      redirectUris: redirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean),
    })
    onCreated(app)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.createTitle}</DialogTitle>
          <DialogDescription>{t.lifecycleUrls}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t.displayName}>
            <Input
              value={displayName}
              placeholder={t.displayNamePlaceholder}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field label={t.slug}>
            <Input
              value={slug}
              placeholder={t.slugPlaceholder}
              onChange={(event) => setSlug(event.target.value)}
            />
          </Field>
          <Field label={t.ownerId}>
            <Input
              value={ownerId}
              placeholder={t.ownerIdPlaceholder}
              onChange={(event) => setOwnerId(event.target.value)}
            />
          </Field>
          <Field label={t.redirectUris} help={t.redirectUrisHelp}>
            <Textarea
              rows={3}
              value={redirectUris}
              className="font-mono text-xs"
              placeholder={t.redirectUrisPlaceholder}
              onChange={(event) => setRedirectUris(event.target.value)}
            />
          </Field>
          {validation || createApp.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {validation ??
                  (createApp.error instanceof Error
                    ? createApp.error.message
                    : messages.common.requestFailed)}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createApp.isPending}
          >
            {messages.common.cancel}
          </Button>
          <Button onClick={submit} disabled={createApp.isPending}>
            {createApp.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {createApp.isPending ? t.creating : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  )
}
