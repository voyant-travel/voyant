import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import { ChevronDown, Loader2, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"

import type { useDistributionUiMessagesOrDefault } from "../i18n/index.js"
import {
  formatShortDuration,
  formatTemplate,
  type ReconcilerResult,
} from "./channel-sync-page-utils.js"

export function ReconcileMenu({
  onRun,
  isRunning,
  lastResult,
  messages,
}: {
  onRun: (flow: "bookings" | "availability" | "content") => void
  isRunning: boolean
  lastResult: ReconcilerResult | null
  messages: ReturnType<typeof useDistributionUiMessagesOrDefault>["channelSync"]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {messages.reconcile.trigger}
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{messages.reconcile.menuLabel}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onRun("bookings")}>
            {messages.reconcile.bookings}
            <span className="ml-auto text-xs text-muted-foreground">
              {messages.reconcile.priority}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRun("availability")}>
            {messages.reconcile.availability}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRun("content")}>
            {messages.reconcile.content}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {lastResult ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {formatTemplate(messages.reconcile.lastRun, {
                scanned: lastResult.scanned,
                triggered: lastResult.triggered,
              })}
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AutoRefreshIndicator({
  isFetching,
  dataUpdatedAt,
  intervalMs,
  messages,
}: {
  isFetching: boolean
  dataUpdatedAt: number
  intervalMs: number
  messages: ReturnType<typeof useDistributionUiMessagesOrDefault>["channelSync"]
}) {
  // Tick every second so the "Updated Xs ago" stays current.
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!dataUpdatedAt) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
        <Loader2 className="h-3 w-3 animate-spin" />
        {messages.refresh.loading}
      </span>
    )
  }

  const seconds = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000))
  const intervalSec = Math.round(intervalMs / 1000)

  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
      title={formatTemplate(messages.refresh.title, { seconds: intervalSec })}
    >
      {isFetching ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
      <span className="tabular-nums">
        {isFetching
          ? messages.refresh.refreshing
          : formatTemplate(messages.refresh.updatedAgo, {
              duration: formatShortDuration(seconds),
            })}
      </span>
    </span>
  )
}
