import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"

export function AvailabilityBodySkeleton() {
  const messages = useAvailabilityUiMessagesOrDefault().page.skeleton
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-44" />
      </div>

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

      <div className="flex items-center gap-1 border-b">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.date}</TableHead>
              <TableHead>{messages.product}</TableHead>
              <TableHead>{messages.status}</TableHead>
              <TableHead>{messages.remaining}</TableHead>
              <TableHead>{messages.capacity}</TableHead>
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

export function AvailabilityRuleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
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

function SkeletonTableRows({
  rows = 6,
  columns = 4,
  columnWidths,
}: {
  rows?: number
  columns?: number
  columnWidths?: Array<string | undefined>
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
          key={r}
        >
          {Array.from({ length: columns }).map((__, c) => {
            const width =
              columnWidths?.[c] ?? (c === 0 ? "w-2/3" : c === columns - 1 ? "w-16" : "w-1/2")

            return (
              <TableCell
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
                key={c}
              >
                <Skeleton className={`h-4 ${width}`} />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </TableBody>
  )
}
