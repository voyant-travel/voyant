import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

export function DashboardKpiSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-5 w-28 rounded-full" />
      </CardContent>
    </Card>
  )
}

export function DashboardKpiRowSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
        <DashboardKpiSkeleton key={i} />
      ))}
    </div>
  )
}

export function DashboardAreaChartSkeleton() {
  return (
    <div className="flex h-[300px] w-full flex-col justify-end gap-2">
      <Skeleton className="h-full w-full rounded-md" />
      <div className="flex justify-between px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          <Skeleton key={i} className="h-3 w-10" />
        ))}
      </div>
    </div>
  )
}

export function DashboardPieChartSkeleton() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-4">
      <Skeleton className="h-[200px] w-[200px] rounded-full" />
      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardBarChartSkeleton() {
  const heights = ["h-24", "h-32", "h-20", "h-40", "h-28", "h-36"]
  return (
    <div className="flex h-[250px] w-full flex-col justify-end gap-2">
      <div className="flex h-full items-end justify-between gap-2 px-1">
        {heights.map((h, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          <Skeleton key={i} className={`${h} w-full rounded-sm`} />
        ))}
      </div>
      <div className="flex justify-between px-1">
        {heights.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          <Skeleton key={i} className="h-3 w-10" />
        ))}
      </div>
    </div>
  )
}

export function DashboardUpcomingListSkeleton({ rows = 4 }: { rows?: number } = {}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          key={i}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardOutstandingInvoicesSkeleton({ rows = 3 }: { rows?: number } = {}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: admin; existing suppression is intentional pending typed cleanup.
          key={i}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      <DashboardKpiRowSkeleton />

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <DashboardAreaChartSkeleton />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <DashboardPieChartSkeleton />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent>
            <DashboardBarChartSkeleton />
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent>
            <DashboardUpcomingListSkeleton />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <DashboardOutstandingInvoicesSkeleton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
