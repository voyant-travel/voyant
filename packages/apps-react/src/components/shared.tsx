"use client"

import type { LocaleFormatters } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import type { ReactNode } from "react"
import type { AppsUiMessages } from "../i18n/messages.js"
import type { AppInstallationRecord } from "../schemas.js"

const STATUS_VARIANT: Record<
  AppInstallationRecord["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  authorizing: "outline",
  active: "default",
  paused: "secondary",
  degraded: "destructive",
  revoked: "destructive",
  uninstalled: "secondary",
}

export function StatusBadge({
  status,
  messages,
}: {
  status: AppInstallationRecord["status"]
  messages: AppsUiMessages
}) {
  return <Badge variant={STATUS_VARIANT[status]}>{messages.statuses[status]}</Badge>
}

/** Render an ISO timestamp compactly using the active locale's formatter. */
export function formatWhen(
  value: string | null | undefined,
  formatDateTime: LocaleFormatters["formatDateTime"],
): string {
  if (!value) return "—"
  return formatDateTime(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Read a string[] off a normalized-release JSONB record. */
export function readScopeArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

export function MonoText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs", className)}>{children}</span>
}

export function SectionEmpty({ children }: { children: string }) {
  return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{children}</p>
}
