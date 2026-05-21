"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { personDocumentRevealResponse } from "../schemas.js"

export interface UseRevealPersonDocumentOptions {
  /**
   * When false, the reveal request is skipped — keeps the reveal
   * button default-off behaviour. Toggle to true when the user clicks
   * reveal. Each render with `enabled: true` is a fresh audit-logged
   * disclosure on the server (`staleTime: 0`).
   */
  enabled: boolean
}

/**
 * Lazily fetches a person document's decrypted number. The endpoint
 * authorizes against the `crm-pii:read` action-ledger capability and
 * writes an audit row tagged `crm.person_document.reveal` per call.
 */
export function useRevealPersonDocument(
  documentId: string | null | undefined,
  options: UseRevealPersonDocumentOptions,
) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    queryKey: crmQueryKeys.personDocumentReveal(documentId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/crm/person-documents/${documentId}/reveal`,
        personDocumentRevealResponse,
        { baseUrl, fetcher },
      ),
    enabled: options.enabled && Boolean(documentId),
    staleTime: 0,
    gcTime: 0,
  })
}
