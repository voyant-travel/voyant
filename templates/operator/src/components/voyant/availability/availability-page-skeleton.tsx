import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

/**
 * Body-only placeholder that slots into the existing page layout while the
 * bundle of availability queries is still loading. The page itself renders
 * the title block outside the loading branch.
 */
export function AvailabilityBodySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-44" />
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
          <Card key={i}>
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

      {/* "Needs attention" */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
              key={i}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Tab panel — default to slots table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Capacity</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonTableRows
            rows={6}
            columns={5}
            columnWidths={["w-24", "w-40", "w-16", "w-16", "w-16"]}
          />
        </Table>
      </div>
    </div>
  )
}

/**
 * Full-page placeholder used as the route's `pendingComponent`. Includes the
 * title/description block so the cold-load shows a complete page shape.
 */
export function AvailabilityPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <AvailabilityBodySkeleton />
    </div>
  )
}
