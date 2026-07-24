"use client"

import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"

/**
 * Pending skeletons for the four resources detail pages.
 *
 * Kept in their own lean module (shared base skeleton + ui primitives only)
 * so the resources admin extension factory — evaluated with the workspace
 * chrome — can attach them as `pendingComponent`s without pinning the heavy
 * detail page modules into the entry chunk. The page modules re-export them
 * for backwards compatibility.
 */

export function ResourceDetailSkeleton() {
  return <BaseResourceDetailSkeleton actionCount={2} detailRows={5} stackedCards={3} />
}

export function ResourcePoolDetailSkeleton() {
  return <BaseResourceDetailSkeleton actionCount={2} detailRows={4} stackedCards={3} />
}

export function ResourceAssignmentDetailSkeleton() {
  return (
    <BaseResourceDetailSkeleton actionCount={3} detailRows={9} showNotes={false} stackedCards={0} />
  )
}

export function ResourceAllocationDetailSkeleton() {
  return (
    <BaseResourceDetailSkeleton actionCount={3} detailRows={7} showNotes={false} stackedCards={0} />
  )
}

function BaseResourceDetailSkeleton({
  actionCount,
  detailRows,
  showNotes = true,
  stackedCards = 2,
}: {
  actionCount: number
  detailRows: number
  showNotes?: boolean
  stackedCards?: number
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
            key={index}
            className="h-9 w-28"
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: detailRows }).map((_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
                key={index}
                className="flex items-center gap-2"
              >
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
        {showNotes ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-2/3" />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {Array.from({ length: stackedCards }).map((_, cardIndex) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
          key={cardIndex}
        >
          <CardHeader className="flex flex-row items-center gap-2">
            <Skeleton className="size-4" />
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, rowIndex) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
                key={rowIndex}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
