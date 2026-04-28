"use client"

import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { cn } from "@voyantjs/voyant-ui/lib/utils"
import type * as React from "react"

export interface ExternalCharterBadgeProps extends React.ComponentPropsWithoutRef<typeof Badge> {
  /** The adapter that sourced the charter (e.g. "voyant-connect", "custom"). */
  sourceProvider: string
}

/**
 * Small inline badge that surfaces charter provenance to admin/storefront UIs.
 * Renders as a subtle "External · <provider>" pill so operators (and shoppers,
 * if surfaced) can tell at a glance which inventory comes from upstream.
 */
export function ExternalCharterBadge({
  sourceProvider,
  className,
  ...props
}: ExternalCharterBadgeProps) {
  return (
    <Badge
      data-slot="external-charter-badge"
      variant="outline"
      className={cn("font-normal", className)}
      title={`Sourced via ${sourceProvider}`}
      {...props}
    >
      <span aria-hidden="true" className="mr-1">
        ↗
      </span>
      External · {sourceProvider}
    </Badge>
  )
}
