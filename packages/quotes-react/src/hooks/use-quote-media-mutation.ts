"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteMediaSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateQuoteMediaInput {
  mediaType?: "image" | "video" | "document"
  name: string
  url: string
  storageKey?: string | null
  mimeType?: string | null
  fileSize?: number | null
  altText?: string | null
}

/** Attach / remove quote media (the upload itself goes through `/v1/admin/uploads`). */
export function useQuoteMediaMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = (quoteId: string) => {
    void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteMedia(quoteId) })
  }

  const create = useMutation({
    mutationFn: async ({ quoteId, input }: { quoteId: string; input: CreateQuoteMediaInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quotes/${quoteId}/media`,
        quoteMediaSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  // Upload a file to the deployment's media store (`/v1/admin/uploads`), then attach
  // the resulting object to the quote. Multipart upload uses a raw cookie-auth
  // fetch (the shared JSON fetcher can't carry FormData).
  const upload = useMutation({
    mutationFn: async ({ quoteId, file }: { quoteId: string; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${baseUrl}/v1/admin/uploads`, {
        method: "POST",
        body: form,
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const uploaded = (await res.json()) as {
        key: string
        url: string
        mimeType: string
        size: number
      }
      const mediaType: CreateQuoteMediaInput["mediaType"] = uploaded.mimeType.startsWith("video/")
        ? "video"
        : uploaded.mimeType.startsWith("image/")
          ? "image"
          : "document"
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quotes/${quoteId}/media`,
        quoteMediaSingleResponse,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            mediaType,
            name: file.name,
            url: uploaded.url,
            storageKey: uploaded.key,
            mimeType: uploaded.mimeType,
            fileSize: uploaded.size,
          } satisfies CreateQuoteMediaInput),
        },
      )
      return data
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; quoteId: string }) => {
      await fetchWithValidation(
        `/v1/admin/quotes/quote-media/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  return { create, upload, remove }
}
