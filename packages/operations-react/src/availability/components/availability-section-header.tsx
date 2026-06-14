"use client"

import { Button } from "@voyant-travel/ui/components"
import { Plus } from "lucide-react"

export interface AvailabilitySectionHeaderProps {
  actionLabel: string
  description: string
  onAction: () => void
  title: string
}

export function AvailabilitySectionHeader({
  actionLabel,
  description,
  onAction,
  title,
}: AvailabilitySectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button onClick={onAction}>
        <Plus className="mr-2 h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  )
}
