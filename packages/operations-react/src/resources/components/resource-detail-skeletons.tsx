"use client"

import { ResourceDetailSkeleton as BaseResourceDetailSkeleton } from "./resource-detail-shared.js"

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
