"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@voyant-travel/ui/components/tooltip"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

export function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  empty,
  emptyLabel,
  isLoading,
}: {
  title: string
  value: string
  description: string
  icon: ReactNode
  trend?: number
  trendLabel?: string
  empty?: boolean
  emptyLabel?: string
  isLoading?: boolean
}) {
  const isPositive = (trend ?? 0) >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-40" />
            {trendLabel ? <Skeleton className="mt-3 h-5 w-28 rounded-full" /> : null}
          </div>
        ) : (
          <>
            {empty ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    className="text-2xl font-semibold tracking-tight text-muted-foreground"
                    aria-label={emptyLabel ?? description}
                  >
                    -
                  </TooltipTrigger>
                  <TooltipContent>{emptyLabel ?? description}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="text-2xl font-semibold tracking-tight">{value}</div>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
            {!empty && trend != null && trendLabel ? (
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    isPositive
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(trend).toFixed(1)}%
                </span>
                <span>{trendLabel}</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
