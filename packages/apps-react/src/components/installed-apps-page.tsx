"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { AlertCircle, Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { useInstallations } from "../hooks/use-installations.js"
import { useAppsUiI18nOrDefault } from "../i18n/index.js"
import type { AppInstallationSummary } from "../schemas.js"
import { ConsentScreen } from "./consent-screen.js"
import { InstallationDetail } from "./installation-detail.js"
import { formatWhen, StatusBadge } from "./shared.js"

const STATUSES = ["active", "paused", "degraded", "pending", "revoked", "uninstalled"] as const
const ALL = "all"
const PAGE_SIZE = 25

export interface InstalledAppsPageProps {
  /** Operator user id recorded as the actor for lifecycle actions. */
  actorId?: string
  customFieldsHref?: string
  className?: string
}

export function InstalledAppsPage({
  actorId = "operator",
  customFieldsHref,
  className,
}: InstalledAppsPageProps = {}) {
  const i18n = useAppsUiI18nOrDefault()
  const { messages } = i18n
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [pageIndex, setPageIndex] = useState(0)
  const [selected, setSelected] = useState<string | undefined>()
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentAppId, setConsentAppId] = useState<string | undefined>()

  // A restricted install link (`/apps?installApp=<id>`) drops the recipient
  // straight into the app-preselected consent flow.
  useEffect(() => {
    if (typeof window === "undefined") return
    const installApp = new URLSearchParams(window.location.search).get("installApp")
    if (installApp) {
      setConsentAppId(installApp)
      setConsentOpen(true)
    }
  }, [])

  const query = useInstallations({
    status: statusFilter === ALL ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  if (selected) {
    return (
      <div className={cn("flex flex-col gap-6 p-6", className)}>
        <InstallationDetail
          installationId={selected}
          actorId={actorId}
          customFieldsHref={customFieldsHref}
          onBack={() => {
            setSelected(undefined)
            void query.refetch()
          }}
        />
      </div>
    )
  }

  const installations = query.data?.data ?? []
  const total = query.data?.total ?? 0

  return (
    <div data-slot="installed-apps-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">{messages.list.title}</h2>
          <p className="text-sm text-muted-foreground">{messages.list.description}</p>
        </div>
        <Button size="sm" onClick={() => setConsentOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          {messages.list.installApp}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value ?? ALL)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{messages.list.allStatuses}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {messages.statuses[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {messages.common.loadFailed}{" "}
            {query.error instanceof Error ? query.error.message : messages.common.requestFailed}
          </AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <div className="h-64 animate-pulse rounded-md border bg-muted/40" />
      ) : installations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium">{messages.list.emptyTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{messages.list.emptyDescription}</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.list.columnApp}</TableHead>
                <TableHead>{messages.list.columnStatus}</TableHead>
                <TableHead>{messages.list.columnRelease}</TableHead>
                <TableHead>{messages.list.columnUpdates}</TableHead>
                <TableHead>{messages.list.columnInstalled}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {installations.map((installation) => (
                <InstallationRow
                  key={installation.id}
                  installation={installation}
                  messages={messages}
                  formatDateTime={i18n.formatDateTime}
                  onView={() => setSelected(installation.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.list.paginationSummary, {
            shown: installations.length,
            total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            {messages.list.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * PAGE_SIZE >= total}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.list.next}
          </Button>
        </div>
      </div>

      <ConsentScreen
        // ConsentScreen seeds its selected app from `appId` only at mount, so
        // key it on the preselected app to re-seed when a restricted install
        // link supplies one.
        key={consentAppId ?? "manual"}
        open={consentOpen}
        onOpenChange={(open) => {
          setConsentOpen(open)
          if (!open) setConsentAppId(undefined)
        }}
        actorId={actorId}
        appId={consentAppId}
        onInstalled={() => void query.refetch()}
      />
    </div>
  )
}

function InstallationRow({
  installation,
  messages,
  formatDateTime,
  onView,
}: {
  installation: AppInstallationSummary
  messages: ReturnType<typeof useAppsUiI18nOrDefault>["messages"]
  formatDateTime: ReturnType<typeof useAppsUiI18nOrDefault>["formatDateTime"]
  onView: () => void
}) {
  return (
    <TableRow className="cursor-pointer" onClick={onView}>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{installation.appDisplayName}</span>
          <span className="font-mono text-xs text-muted-foreground">{installation.appSlug}</span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={installation.status} messages={messages} />
      </TableCell>
      <TableCell className="font-mono text-xs">{installation.releaseVersion}</TableCell>
      <TableCell>
        {installation.pendingReleaseId ? (
          <Badge variant="destructive">
            {messages.list.updatesBlocked.replace("{count}", "1")}
          </Badge>
        ) : (
          <Badge variant="outline">{messages.list.upToDate}</Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatWhen(installation.installedAt, formatDateTime)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onView()
          }}
        >
          {messages.list.view}
        </Button>
      </TableCell>
    </TableRow>
  )
}
