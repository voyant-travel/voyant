"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { useProductDetailApi } from "../host.js"
import { type EditorialOverlayState, editorialOverlayStateSchema } from "./types.js"

/**
 * Overlay scope the operator editor authors in. Audience and market stay
 * pinned to the customer/default storefront scope in this slice — audience and
 * market previewing is a later phase of RFC #3666 and must not be inferred
 * from the UI implicitly.
 */
export const EDITORIAL_OVERLAY_AUDIENCE = "customer"
export const EDITORIAL_OVERLAY_MARKET = "default"

export interface EditorialOverlayTarget {
  nodeKind: string
  nodeKey: string
  fieldPath: string
}

export interface EditorialOverlayWriteInput extends EditorialOverlayTarget {
  value: unknown
  expectedVersion: number | null
  editorialNote?: string
}

/** Thrown when the server reports an optimistic-concurrency conflict. */
export class EditorialOverlayConflictError extends Error {
  readonly currentVersion: number | null
  readonly expectedVersion: number | null

  constructor(message: string, currentVersion: number | null, expectedVersion: number | null) {
    super(message)
    this.name = "EditorialOverlayConflictError"
    this.currentVersion = currentVersion
    this.expectedVersion = expectedVersion
  }
}

export function editorialOverlayQueryKey(productId: string, locale: string) {
  return ["products", productId, "editorial-overlays", locale] as const
}

function basePath(productId: string, locale: string): string {
  const params = new URLSearchParams({
    locale,
    audience: EDITORIAL_OVERLAY_AUDIENCE,
    market: EDITORIAL_OVERLAY_MARKET,
  })
  return `/v1/admin/products/${encodeURIComponent(productId)}/editorial-overlays?${params.toString()}`
}

export function useEditorialOverlayState(productId: string, locale: string, enabled = true) {
  const api = useProductDetailApi()
  return useQuery({
    queryKey: editorialOverlayQueryKey(productId, locale),
    enabled: enabled && Boolean(productId) && Boolean(locale),
    queryFn: async (): Promise<EditorialOverlayState> => {
      const raw = await api.get<unknown>(basePath(productId, locale))
      return editorialOverlayStateSchema.parse(raw).data
    },
  })
}

export function useEditorialOverlayMutations(productId: string, locale: string) {
  const api = useProductDetailApi()
  const queryClient = useQueryClient()
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: editorialOverlayQueryKey(productId, locale) }),
    [queryClient, productId, locale],
  )

  const write = useMutation({
    mutationFn: async (input: EditorialOverlayWriteInput) => {
      const put = api.put
      if (!put) throw new Error("This host does not support editorial overlay writes.")
      try {
        return await put(`/v1/admin/products/${encodeURIComponent(productId)}/editorial-overlays`, {
          nodeKind: input.nodeKind,
          nodeKey: input.nodeKey,
          fieldPath: input.fieldPath,
          locale,
          audience: EDITORIAL_OVERLAY_AUDIENCE,
          market: EDITORIAL_OVERLAY_MARKET,
          value: input.value,
          expectedVersion: input.expectedVersion,
          ...(input.editorialNote ? { editorialNote: input.editorialNote } : {}),
        })
      } catch (error) {
        throw toConflictError(error, input.expectedVersion)
      }
    },
    onSuccess: invalidate,
  })

  const clear = useMutation({
    mutationFn: async (input: EditorialOverlayTarget & { expectedVersion: number | null }) => {
      const params = new URLSearchParams({
        locale,
        audience: EDITORIAL_OVERLAY_AUDIENCE,
        market: EDITORIAL_OVERLAY_MARKET,
        nodeKind: input.nodeKind,
        nodeKey: input.nodeKey,
        fieldPath: input.fieldPath,
      })
      if (input.expectedVersion != null) {
        params.set("expectedVersion", String(input.expectedVersion))
      }
      try {
        return await api.delete(
          `/v1/admin/products/${encodeURIComponent(productId)}/editorial-overlays?${params.toString()}`,
        )
      } catch (error) {
        throw toConflictError(error, input.expectedVersion)
      }
    },
    onSuccess: invalidate,
  })

  return { write, clear, invalidate }
}

/**
 * `409` from the overlay routes carries `{ error: "version_conflict",
 * currentVersion }`. Surface it as a typed error so the editor can show a
 * conflict banner instead of silently overwriting another editor's work.
 */
function toConflictError(error: unknown, expectedVersion: number | null): unknown {
  const status = (error as { status?: number } | null)?.status
  if (status !== 409) return error
  const body = (error as { body?: { error?: string; currentVersion?: number | null } }).body
  return new EditorialOverlayConflictError(
    body?.error ?? "version_conflict",
    body?.currentVersion ?? null,
    expectedVersion,
  )
}
