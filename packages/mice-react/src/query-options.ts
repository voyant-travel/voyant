"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import {
  type DelegateListFilters,
  miceQueryKeys,
  type ProgramListFilters,
  type RfpListFilters,
} from "./query-keys.js"
import {
  bookingMiceDetailResponse,
  delegateListResponse,
  programCostSheetResponse,
  programListResponse,
  programSingleResponse,
  rfpDetailResponse,
  rfpListResponse,
  roomingDetailResponse,
  roomingListResponse,
  sessionListResponse,
} from "./schemas.js"

const basePath = "/v1/admin/mice"

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// Filter interfaces have no index signature; this narrows them for `qs`.
const asParams = (f: object): Record<string, string | number | undefined> =>
  f as Record<string, string | number | undefined>

export function getProgramsQueryOptions(
  client: FetchWithValidationOptions,
  filters: ProgramListFilters = {},
) {
  return queryOptions({
    queryKey: miceQueryKeys.programsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/programs${qs(asParams(filters))}`,
        programListResponse,
        client,
      ),
  })
}

export function getProgramQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: miceQueryKeys.program(id),
    queryFn: () => fetchWithValidation(`${basePath}/programs/${id}`, programSingleResponse, client),
  })
}

export function getProgramCostSheetQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: miceQueryKeys.programCostSheet(id),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/programs/${id}/cost-sheet`,
        programCostSheetResponse,
        client,
      ),
  })
}

// 200 is the backend's hard per-page max (`sessionListQuerySchema`). A program's
// agenda is bounded well below that, so the surface requests the full page in one
// shot instead of paginating — without an explicit limit the backend defaults to
// 50 and would silently drop the rest.
const SESSIONS_PAGE_LIMIT = 200

export function getSessionsQueryOptions(
  client: FetchWithValidationOptions,
  programId: string,
  limit: number = SESSIONS_PAGE_LIMIT,
) {
  return queryOptions({
    queryKey: miceQueryKeys.sessionsList(programId),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/sessions${qs({ programId, limit })}`,
        sessionListResponse,
        client,
      ),
  })
}

export function getDelegatesQueryOptions(
  client: FetchWithValidationOptions,
  filters: DelegateListFilters,
) {
  return queryOptions({
    queryKey: miceQueryKeys.delegatesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/delegates${qs(asParams(filters))}`,
        delegateListResponse,
        client,
      ),
  })
}

const ROOMING_PAGE_LIMIT = 500

export function getRoomingQueryOptions(
  client: FetchWithValidationOptions,
  programId: string,
  limit: number = ROOMING_PAGE_LIMIT,
) {
  return queryOptions({
    queryKey: miceQueryKeys.roomingList(programId),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/rooming-assignments${qs({ programId, limit })}`,
        roomingListResponse,
        client,
      ),
  })
}

export function getRoomingAssignmentQueryOptions(
  client: FetchWithValidationOptions,
  assignmentId: string,
) {
  return queryOptions({
    queryKey: miceQueryKeys.roomingAssignment(assignmentId),
    queryFn: () =>
      fetchWithValidation(
        `${basePath}/rooming-assignments/${assignmentId}`,
        roomingDetailResponse,
        client,
      ),
  })
}

export function getBookingMiceDetailsQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string,
) {
  return queryOptions({
    queryKey: miceQueryKeys.bookingMiceDetails(bookingId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/bookings/${encodeURIComponent(bookingId)}/mice-details`,
        bookingMiceDetailResponse,
        client,
      ),
  })
}

export function getRfpsQueryOptions(client: FetchWithValidationOptions, filters: RfpListFilters) {
  return queryOptions({
    queryKey: miceQueryKeys.rfpsList(filters),
    queryFn: () =>
      fetchWithValidation(`${basePath}/rfps${qs(asParams(filters))}`, rfpListResponse, client),
  })
}

export function getRfpQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: miceQueryKeys.rfp(id),
    queryFn: () => fetchWithValidation(`${basePath}/rfps/${id}`, rfpDetailResponse, client),
  })
}
