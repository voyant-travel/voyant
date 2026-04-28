import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"

/**
 * Mirrors AvailabilityStartTimeDetailPage: header (back + label + two pills +
 * Open Product/Delete); 2-col layout — Start Time Details (6 rows) and
 * Generated Slots (list).
 */
export function AvailabilityStartTimeDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>

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
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
