"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"

/**
 * Cross-domain label resolvers for the invoice detail "Dates & Links" card.
 *
 * The invoice record only carries the linked ids (`personId`, `bookingId`,
 * `organizationId`). To show a contextual label (person name, booking number,
 * organization name) before the operator clicks through, we resolve each id
 * against its owning domain's admin API directly through finance's own client
 * — the established pattern (cf. attachment downloads in
 * `invoice-detail-sections.tsx` and the commerce-react pricing comboboxes that
 * fetch other domains' endpoints). We deliberately do NOT depend on
 * `@voyant-travel/relationships-react` or `@voyant-travel/bookings-react`.
 *
 * Each hook is `enabled` only when an id is present, and returns a display
 * string or `undefined` (loading / unresolved). Callers fall back to the
 * existing generic i18n "View X" label when the resolved value is absent.
 */

const personLinkResponse = z.object({
  data: z
    .object({
      firstName: z.string().nullish(),
      lastName: z.string().nullish(),
      email: z.string().nullish(),
    })
    .passthrough(),
})

const bookingLinkResponse = z.object({
  data: z.object({ bookingNumber: z.string().nullish() }).passthrough(),
})

const organizationLinkResponse = z.object({
  data: z.object({ name: z.string().nullish() }).passthrough(),
})

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Resolves a person id to a display name.
 * Prefers `firstName lastName`, falls back to `email`, else `undefined`.
 */
export function useInvoicePersonLabel(personId: string | null | undefined): string | undefined {
  const { baseUrl, fetcher } = useVoyantFinanceContext()

  const { data } = useQuery({
    queryKey: [...financeQueryKeys.all, "link", "person", personId ?? ""] as const,
    queryFn: async () => {
      if (!personId) throw new Error("useInvoicePersonLabel requires a personId")
      return fetchWithValidation(`/v1/admin/relationships/people/${personId}`, personLinkResponse, {
        baseUrl,
        fetcher,
      })
    },
    enabled: Boolean(personId),
    staleTime: 5 * 60 * 1000,
  })

  if (!data) return undefined
  const name = nonEmpty([data.data.firstName, data.data.lastName].filter(Boolean).join(" "))
  return name ?? nonEmpty(data.data.email)
}

/**
 * Resolves a booking id to its booking number.
 */
export function useInvoiceBookingLabel(bookingId: string | null | undefined): string | undefined {
  const { baseUrl, fetcher } = useVoyantFinanceContext()

  const { data } = useQuery({
    queryKey: [...financeQueryKeys.all, "link", "booking", bookingId ?? ""] as const,
    queryFn: async () => {
      if (!bookingId) throw new Error("useInvoiceBookingLabel requires a bookingId")
      return fetchWithValidation(`/v1/admin/bookings/${bookingId}`, bookingLinkResponse, {
        baseUrl,
        fetcher,
      })
    },
    enabled: Boolean(bookingId),
    staleTime: 5 * 60 * 1000,
  })

  if (!data) return undefined
  return nonEmpty(data.data.bookingNumber)
}

/**
 * Resolves an organization id to its name.
 */
export function useInvoiceOrganizationLabel(
  organizationId: string | null | undefined,
): string | undefined {
  const { baseUrl, fetcher } = useVoyantFinanceContext()

  const { data } = useQuery({
    queryKey: [...financeQueryKeys.all, "link", "organization", organizationId ?? ""] as const,
    queryFn: async () => {
      if (!organizationId) throw new Error("useInvoiceOrganizationLabel requires an organizationId")
      return fetchWithValidation(
        `/v1/admin/relationships/organizations/${organizationId}`,
        organizationLinkResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  })

  if (!data) return undefined
  return nonEmpty(data.data.name)
}
