import type { QueryClient } from "@tanstack/react-query"
import type { AsyncComboboxOption } from "@voyantjs/finance-react/ui"
import { getSuppliersQueryOptions, suppliersQueryKeys } from "@voyantjs/suppliers-react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

/**
 * Supplier picker wiring for the supplier-invoice form. Selecting an existing
 * supplier or creating one inline stores the supplier's id as the invoice's
 * `supplierId` — a loose text reference, no cross-module FK. New suppliers are
 * created with type "other" (editable later in the suppliers module).
 */
export function makeSupplierPicker(queryClient: QueryClient) {
  const searchSuppliers = async (query: string): Promise<AsyncComboboxOption[]> => {
    const res = await queryClient.fetchQuery(
      getSuppliersQueryOptions(client, { search: query || undefined, limit: 20 }),
    )
    return res.data.map((supplier) => ({ value: supplier.id, label: supplier.name }))
  }

  const createSupplier = async (name: string): Promise<AsyncComboboxOption | null> => {
    const response = await fetch(`${getApiUrl()}/v1/suppliers`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, type: "other" }),
    })
    if (!response.ok) {
      throw new Error(`Create supplier failed: ${response.status} ${response.statusText}`)
    }
    const { data } = (await response.json()) as { data: { id: string; name: string } }
    void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.suppliers() })
    return { value: data.id, label: data.name }
  }

  return { searchSuppliers, createSupplier }
}
