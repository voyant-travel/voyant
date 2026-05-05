"use client"

import type { z } from "zod"
import {
  type FetchWithValidationOptions,
  fetchWithValidation,
  type VoyantFetcher,
} from "../client.js"
import { useVoyantCatalogContext } from "../provider.js"

export interface BookingJourneyApiOptions {
  /**
   * Surface to call against. Operator passes `"admin"`; storefront /
   * partner / embedded surfaces pass `"public"`. Switches the base
   * path between `/v1/admin/catalog` and `/v1/public/catalog`.
   */
  surface?: "admin" | "public"
  /** Override the API base URL pulled from VoyantCatalogProvider. */
  baseUrl?: string
  /** Override the fetcher pulled from VoyantCatalogProvider. */
  fetcher?: VoyantFetcher
}

export interface UseBookingJourneyApi {
  /** Resolved base URL for catalog booking-engine endpoints. */
  apiBase: string
  fetcher: VoyantFetcher
  /** GET / POST / PUT / DELETE wrappers with Zod-validated responses. */
  request<TOut>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    schema: z.ZodType<TOut>,
    body?: unknown,
  ): Promise<TOut>
}

export function useBookingJourneyApi(options: BookingJourneyApiOptions = {}): UseBookingJourneyApi {
  const ctx = useVoyantCatalogContext()
  const baseUrl = options.baseUrl ?? ctx.baseUrl
  const fetcher = options.fetcher ?? ctx.fetcher
  const surface = options.surface ?? "admin"
  const apiBase = `${stripTrailingSlash(baseUrl)}/v1/${surface}/catalog`

  const fetchOptions: FetchWithValidationOptions = { baseUrl, fetcher }

  return {
    apiBase,
    fetcher,
    async request<TOut>(
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      schema: z.ZodType<TOut>,
      body?: unknown,
    ): Promise<TOut> {
      const init: RequestInit = { method }
      if (body !== undefined) init.body = JSON.stringify(body)
      return fetchWithValidation<TOut>(`/v1/${surface}/catalog${path}`, schema, fetchOptions, init)
    },
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}
