import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"

/**
 * Mirrors AvailabilitySlotDetailPage: back+title(date)+status/timezone pills
 * + actions header; 2-col Slot Details (7 rows) / Capacity State (7 rows);
 * Pickup Capacity card (3 rows); Resource Assignments card.
 */
export function AvailabilitySlotDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PairListCard titleWidth="w-24" rows={7} />
        <PairListCard titleWidth="w-28" rows={7} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
              key={i}
              className="rounded-md border p-3 space-y-1.5"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-44" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
              key={i}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function PairListCard({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-5 ${titleWidth}`} />
      </CardHeader>
      <CardContent className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
