"use client"

import { formatMessage } from "@voyantjs/i18n"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import type * as React from "react"

import { useCruisesUiI18nOrDefault } from "../i18n/index.js"

export interface ExternalCruiseBadgeProps extends React.ComponentPropsWithoutRef<typeof Badge> {
  /** The adapter that sourced the cruise (e.g. "voyant-connect", "custom"). */
  sourceProvider: string
}

/**
 * Small inline badge that surfaces cruise provenance to admin/storefront UIs.
 * Renders as a subtle "External · <provider>" pill so operators (and shoppers,
 * if the storefront opts in) can see at a glance which inventory comes from
 * upstream and which is the operator's own.
 */
export function ExternalCruiseBadge({
  sourceProvider,
  className,
  ...props
}: ExternalCruiseBadgeProps) {
  const { messages } = useCruisesUiI18nOrDefault()
  const m = messages.externalCruiseBadge

  return (
    <Badge
      data-slot="external-cruise-badge"
      variant="outline"
      className={cn("font-normal", className)}
      title={formatMessage(m.title, { sourceProvider })}
      {...props}
    >
      <span aria-hidden="true" className="mr-1">
        ↗
      </span>
      {formatMessage(m.label, { sourceProvider })}
    </Badge>
  )
}
