import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Layout-matched placeholder for PaymentDetailHost.
 *  - Back button + title + status pill
 *  - Two-column info grid: summary + links
 *  - Metadata card (full width)
 */
export function PaymentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard rows={5} titleWidth="w-32" />
        <InfoCard rows={3} titleWidth="w-20" />
      </div>

      <InfoCard rows={4} titleWidth="w-24" />
    </div>
  )
}

function InfoCard({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-5 ${titleWidth}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: finance-react; existing suppression is intentional pending typed cleanup.
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
