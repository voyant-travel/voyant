"use client"

import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"

const TABLE_COLUMNS = [
  { id: "name", headerWidth: "w-16", width: "w-40" },
  { id: "kind", headerWidth: "w-12", width: "w-20" },
  { id: "supplier", headerWidth: "w-16", width: "w-32" },
  { id: "capacity", headerWidth: "w-16", width: "w-16" },
  { id: "status", headerWidth: "w-14", width: "w-16" },
] as const

/** Body-only placeholder used inside the live page while queries load. */
export function ResourcesBodySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => `kpi-${index}`).map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3.5 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two stacked "attention" cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["attention-a", "attention-b"] as const).map((cardKey) => (
          <Card key={cardKey}>
            <CardHeader>
              <Skeleton className="h-5 w-52" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 3 }, (_, index) => `${cardKey}-row-${index}`).map((rowKey) => (
                <div
                  key={rowKey}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Tab panel — resources table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {TABLE_COLUMNS.map((column) => (
                <TableHead key={column.id}>
                  <Skeleton className={`h-3.5 ${column.headerWidth}`} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }, (_, index) => `row-${index}`).map((rowKey) => (
              <TableRow key={rowKey}>
                {TABLE_COLUMNS.map((column) => (
                  <TableCell key={`${rowKey}-${column.id}`}>
                    <Skeleton className={`h-4 ${column.width}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Route-level placeholder for the resources dashboard — title block + filter row + body. */
export function ResourcesPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-[36rem]" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-44" />
      </div>
      <ResourcesBodySkeleton />
    </div>
  )
}
