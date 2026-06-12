"use client"

import { useQueryClient } from "@tanstack/react-query"
import { getSuppliersQueryOptions, useSupplierMutation } from "@voyantjs/suppliers-react"

import type { AsyncComboboxOption } from "../components/async-combobox.js"
import { useVoyantFinanceContext } from "../provider.js"

export interface SupplierPicker {
  searchSuppliers: (query: string) => Promise<AsyncComboboxOption[]>
  createSupplier: (name: string) => Promise<AsyncComboboxOption | null>
}

/**
 * Supplier picker wiring for the supplier-invoice forms. Selecting an
 * existing supplier or creating one inline stores the supplier's id as the
 * invoice's `supplierId` — a loose text reference, no cross-module FK.
 *
 * Search composes the suppliers package's own query options through the
 * shared provider context (`baseUrl` + credentialed fetcher), so results
 * land in the suppliers query cache. Inline creation goes through
 * `useSupplierMutation().create` — the suppliers package's client hook for
 * `POST /v1/suppliers` — with type `"other"` (editable later in the
 * suppliers module); the hook seeds/invalidates the suppliers caches itself.
 */
export function useSupplierPicker(): SupplierPicker {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()
  const { create } = useSupplierMutation()

  const searchSuppliers = async (query: string): Promise<AsyncComboboxOption[]> => {
    const result = await queryClient.fetchQuery(
      getSuppliersQueryOptions({ baseUrl, fetcher }, { search: query || undefined, limit: 20 }),
    )
    return result.data.map((supplier) => ({ value: supplier.id, label: supplier.name }))
  }

  const createSupplier = async (name: string): Promise<AsyncComboboxOption | null> => {
    const supplier = await create.mutateAsync({ name, type: "other" })
    return { value: supplier.id, label: supplier.name }
  }

  return { searchSuppliers, createSupplier }
}
