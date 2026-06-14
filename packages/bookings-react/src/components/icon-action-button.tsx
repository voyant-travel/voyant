"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyant-travel/ui/components/tooltip"
import type * as React from "react"

export interface IconActionButtonProps {
  /** Label shown in the tooltip and used as `aria-label`. */
  label: string
  /** Lucide icon (or any node) rendered inside the button. */
  icon: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Standard table-action icon button with a tooltip. Wraps the design
 * system's `<Button variant="ghost" size="icon-sm">` with a base-ui
 * tooltip so every action across the booking detail tables exposes a
 * short verb hint on hover.
 */
export function IconActionButton({
  label,
  icon,
  className,
  disabled,
  onClick,
}: IconActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={className}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
