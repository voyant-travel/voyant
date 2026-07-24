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
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </CardHeader>
      <CardContent className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            {trendLabel ? <Skeleton className="mt-3 h-5 w-28 rounded-sm" /> : null}
          </div>
        ) : (
          <>
            {empty ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    className="font-data text-3xl font-normal tracking-tight text-muted-foreground opacity-50"
                    aria-label={emptyLabel ?? description}
                  >
                    —
                  </TooltipTrigger>
                  <TooltipContent>{emptyLabel ?? description}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="font-data text-3xl font-semibold tracking-tight">{value}</div>
            )}
            {!empty && trend != null && trendLabel ? (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium ${
                    isPositive ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
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
