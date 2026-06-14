import { Badge } from "@voyant-travel/ui/components/badge"
import { cn } from "@voyant-travel/ui/lib/utils"
import type * as React from "react"

/**
 * Domain-agnostic semantic tier used to colour-code workflow statuses
 * across the booking detail tables. Map your status string to one of
 * these tones via `getStatusTone()` (or pass a tone explicitly).
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral"

const SUCCESS_STATUSES = new Set([
  "paid",
  "completed",
  "confirmed",
  "fulfilled",
  "active",
  "succeeded",
  "captured",
  "approved",
  "settled",
  "issued",
])

const WARNING_STATUSES = new Set([
  "pending",
  "due",
  "on_hold",
  "in_progress",
  "awaiting_payment",
  "draft",
  "partially_paid",
  "authorized",
  "pending_external_allocation",
])

const DANGER_STATUSES = new Set([
  "cancelled",
  "failed",
  "refunded",
  "expired",
  "void",
  "overdue",
  "rejected",
  "declined",
])

/**
 * Best-effort mapping of a status string to a colour tier. Unknown
 * values fall back to `neutral` so the badge renders with the default
 * outline treatment — no accidental green-on-unknown surprises.
 */
export function getStatusTone(status: string): StatusTone {
  const key = status.toLowerCase()
  if (SUCCESS_STATUSES.has(key)) return "success"
  if (WARNING_STATUSES.has(key)) return "warning"
  if (DANGER_STATUSES.has(key)) return "danger"
  return "neutral"
}

const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "border-transparent bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  danger: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "",
}

/**
 * Colour-coded status badge. Pass either a raw `status` string (mapped
 * via `getStatusTone()`) or an explicit `tone`.
 */
export function StatusBadge({
  status,
  tone,
  className,
  children,
}: {
  status?: string
  tone?: StatusTone
  className?: string
  children: React.ReactNode
}) {
  const resolved = tone ?? (status ? getStatusTone(status) : "neutral")
  return (
    <Badge variant="outline" className={cn(TONE_CLASS[resolved], className)}>
      {children}
    </Badge>
  )
}
