import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Route-level placeholder for the booking detail page. Mirrors the
 * canonical `BookingDetailPage` layout (header row, summary card, tab
 * bar, two list cards) so the pending state doesn't shift the page.
 */
export function BookingDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <SummaryCard />
      <TabsBar />
      <ListCard titleWidth="w-32" rows={3} />
      <ListCard titleWidth="w-28" rows={2} />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  )
}

function SummaryCard() {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: bookings-react; existing suppression is intentional pending typed cleanup.
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TabsBar() {
  const widths = ["w-20", "w-20", "w-16", "w-20", "w-24", "w-16"]
  return (
    <div className="flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
      {widths.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: bookings-react; existing suppression is intentional pending typed cleanup.
        <Skeleton key={i} className={`h-7 rounded-md ${w}`} />
      ))}
    </div>
  )
}

function ListCard({ titleWidth, rows }: { titleWidth: string; rows: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: bookings-react; existing suppression is intentional pending typed cleanup.
            key={i}
            className="flex items-center justify-between rounded-md border px-3 py-3"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
