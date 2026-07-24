import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Layout-matched placeholder for ProductDetailPage. Mirrors the real shell:
 *   - Header: title + status + action buttons
 *   - 2-column body (1fr + 320px)
 *     - Left stack: Details, Departures, Schedules, Itinerary (3 days), Options
 *     - Right stack: Channels, Organize, Media (3x3 grid)
 */
export function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ProductDetailHeaderSkeleton />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-6">
          <ProductDetailsSectionSkeleton />
          <ProductDeparturesSectionSkeleton />
          <ProductSchedulesSectionSkeleton />
          <ProductItinerarySectionSkeleton />
          <ProductOptionsSectionSkeleton />
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-6">
          <ProductChannelsSectionSkeleton />
          <ProductOrganizeSectionSkeleton />
          <ProductMediaSectionSkeleton />
        </div>
      </div>
    </div>
  )
}

// ---------- Header ----------

function ProductDetailHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  )
}

// ---------- Left column sections ----------

/** Product details: 2-column grid of label/value pairs. */
function ProductDetailsSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-36" action>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/** Departures: row-per-slot list. */
function ProductDeparturesSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-28" action>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
            key={i}
            className="flex items-center gap-4 rounded-md border px-4 py-3"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/** Recurring schedules: sparse list, often empty. */
function ProductSchedulesSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-44" action>
      <div className="rounded-md border px-4 py-6 text-center">
        <Skeleton className="mx-auto h-4 w-80" />
      </div>
    </SectionShell>
  )
}

/** Itinerary: 3 day rows with cover thumbnail + title. */
function ProductItinerarySectionSkeleton() {
  return (
    <SectionShell titleWidth="w-24" action>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
            key={i}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-10 w-14 rounded" />
            <Skeleton className="h-4 w-40" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/** Options: one option card with Units + Pricing sub-sections. */
function ProductOptionsSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-20" action>
      <div className="rounded-lg border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <div className="space-y-4 border-t px-4 py-4">
          {/* Units */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-7 w-24" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
                key={i}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          {/* Pricing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-32" />
            </div>
            <div className="rounded-md border px-3 py-3 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

// ---------- Right column sections ----------

function ProductChannelsSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-28">
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
            key={i}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

function ProductOrganizeSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-20">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/** Media gallery: 3x2 thumbnail grid. */
function ProductMediaSectionSkeleton() {
  return (
    <SectionShell titleWidth="w-14" action>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
          <Skeleton key={i} className="aspect-square w-full rounded-md" />
        ))}
      </div>
    </SectionShell>
  )
}

// ---------- Shared shell ----------

function SectionShell({
  titleWidth,
  action = false,
  children,
}: {
  titleWidth: string
  action?: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className={`h-5 ${titleWidth}`} />
        {action ? <Skeleton className="h-8 w-8 rounded" /> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
