import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Layout-matched placeholder for InvoiceDetailHost.
 *   - Back + invoice number + status pill + edit/delete
 *   - InvoiceInfoCards: 3-column summary row (Overview / Totals / Booking)
 *   - Line items card (full width)
 *   - Payments card (full width)
 *   - Credit notes card (full width)
 *   - Notes card (composer + list)
 */
export function InvoiceDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Header />

      {/* InvoiceInfoCards: three summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard titleWidth="w-20" rows={4} />
        <InfoCard titleWidth="w-16" rows={4} />
        <InfoCard titleWidth="w-20" rows={3} />
      </div>

      <LineItemsCard />
      <PaymentsCard />
      <CreditNotesCard />
      <NotesCard />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
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
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function LineItemsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <CardContent>
        <div className="space-y-0 divide-y rounded-md border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: finance-react; existing suppression is intentional pending typed cleanup.
              key={i}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: finance-react; existing suppression is intentional pending typed cleanup.
            key={i}
            className="flex items-center justify-between rounded-md border px-3 py-3"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function CreditNotesCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}

function NotesCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-16" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: finance-react; existing suppression is intentional pending typed cleanup.
              key={i}
              className="rounded-md border px-3 py-3 space-y-2"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
