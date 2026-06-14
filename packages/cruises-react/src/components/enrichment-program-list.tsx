"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@voyant-travel/ui/components/avatar"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Card, CardContent } from "@voyant-travel/ui/components/card"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Camera, Compass, GraduationCap, Mic, ScrollText, Sparkles } from "lucide-react"
import type * as React from "react"
import { useCruisesUiI18nOrDefault } from "../i18n/index.js"
import { type EnrichmentProgramRecord, useEnrichmentPrograms } from "../index.js"

const KIND_ICON: Record<
  EnrichmentProgramRecord["kind"],
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  naturalist: Compass,
  historian: ScrollText,
  photographer: Camera,
  lecturer: Mic,
  expert: GraduationCap,
  other: Sparkles,
}

export interface EnrichmentProgramListProps extends React.HTMLAttributes<HTMLDivElement> {
  cruiseKey: string
  emptyState?: React.ReactNode
}

/**
 * Connected list of expedition enrichment staff (naturalists, historians,
 * photographers, lecturers, experts) for a given cruise. Pure read-only
 * display — for editing, pair with a separate enrichment-form component
 * driven by `useEnrichmentMutation`.
 */
export function EnrichmentProgramList({
  cruiseKey,
  emptyState,
  className,
  ...props
}: EnrichmentProgramListProps) {
  const { messages } = useCruisesUiI18nOrDefault()
  const m = messages.enrichmentProgramList
  const { data, isLoading } = useEnrichmentPrograms(cruiseKey)

  if (isLoading) {
    return (
      <div data-slot="enrichment-loading" className={cn("py-8 text-center", className)} {...props}>
        <p className="text-muted-foreground">{m.loading}</p>
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <div data-slot="enrichment-empty" className={cn("py-8 text-center", className)} {...props}>
        {emptyState ?? <p className="text-muted-foreground">{m.empty}</p>}
      </div>
    )
  }
  return (
    <div
      data-slot="enrichment-list"
      className={cn("grid gap-4 sm:grid-cols-2", className)}
      {...props}
    >
      {data.map((program) => {
        const Icon = KIND_ICON[program.kind]
        const initials = program.name
          .split(/\s+/)
          .map((part) => part[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase()
        return (
          <Card key={program.id} data-slot="enrichment-card" className="overflow-hidden">
            <CardContent className="flex gap-4 p-4">
              <Avatar className="size-14 shrink-0">
                {program.bioImageUrl ? (
                  <AvatarImage src={program.bioImageUrl} alt={program.name} />
                ) : null}
                <AvatarFallback>{initials || m.avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    <Icon aria-hidden className="mr-1 size-3" />
                    {m.kindLabels[program.kind]}
                  </Badge>
                </div>
                <div className="font-semibold truncate">{program.name}</div>
                {program.title ? (
                  <div className="text-sm text-muted-foreground truncate">{program.title}</div>
                ) : null}
                {program.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {program.description}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
