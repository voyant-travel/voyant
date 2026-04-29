"use client"

import { type StorefrontListFilters, useStorefrontCruises } from "@voyantjs/cruises-react"
import { formatMessage } from "@voyantjs/i18n"
import type * as React from "react"

import { cn } from "@/lib/utils"
import { CruiseCard } from "./cruise-card"
import { useRegistryCruisesI18nOrDefault } from "./i18n"

export interface CruiseListProps extends React.HTMLAttributes<HTMLDivElement> {
  filters?: StorefrontListFilters
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
  onSelectCruise?: (slug: string) => void
}

/**
 * Connected cruise list — calls `useStorefrontCruises` and renders a card
 * grid. Pass `filters` to scope the query (cruiseType, region, dateFrom,
 * priceMax, etc.). Empty/loading states are overrideable.
 */
export function CruiseList({
  filters = {},
  emptyState,
  loadingState,
  onSelectCruise,
  className,
  ...props
}: CruiseListProps) {
  const { messages } = useRegistryCruisesI18nOrDefault()
  const m = messages.cruiseList
  const { data, isLoading, isError, error } = useStorefrontCruises(filters)

  if (isLoading) {
    return (
      <div
        data-slot="cruise-list-loading"
        className={cn("py-12 text-center", className)}
        {...props}
      >
        {loadingState ?? <p className="text-muted-foreground">{m.loading}</p>}
      </div>
    )
  }
  if (isError) {
    return (
      <div data-slot="cruise-list-error" className={cn("py-12 text-center", className)} {...props}>
        <p className="text-destructive">
          {formatMessage(m.error, { message: (error as Error).message })}
        </p>
      </div>
    )
  }
  if (!data || data.data.length === 0) {
    return (
      <div data-slot="cruise-list-empty" className={cn("py-12 text-center", className)} {...props}>
        {emptyState ?? <p className="text-muted-foreground">{m.empty}</p>}
      </div>
    )
  }
  return (
    <div
      data-slot="cruise-list"
      className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    >
      {data.data.map((cruise) => (
        <CruiseCard
          key={cruise.id}
          cruise={cruise}
          onSelect={onSelectCruise ? () => onSelectCruise(cruise.slug) : undefined}
        />
      ))}
    </div>
  )
}
