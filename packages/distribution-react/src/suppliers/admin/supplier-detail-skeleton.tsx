"use client"

import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Layout-matched route-level placeholder for `SupplierDetailPage`:
 *   - Back button + name + status pill + edit/delete actions
 *   - 2-col summary cards (Supplier Details + Primary Contact)
 *   - Services card (full width) with expandable rows
 *   - Notes card (full width)
 */
export function SupplierDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Header />

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard titleWidth="w-36" rows={8} />
        <SummaryCard titleWidth="w-32" rows={7} />
      </div>

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-28" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => `service-${index}`).map((key) => (
            <div key={key} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

function SummaryCard({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-5 ${titleWidth}`} />
      </CardHeader>
      <CardContent className="grid gap-3">
        {Array.from({ length: rows }, (_, index) => `row-${index}`).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
