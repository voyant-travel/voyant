import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"

/**
 * Mirrors ResourceAssignmentDetailPage: header (back + "Slot Assignment" +
 * status/slot pills + Open Slot/Open Resource/Delete); Assignment Details
 * card with a 2-col label/value grid (~8 rows).
 */
export function ResourceAssignmentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-24" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
