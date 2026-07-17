"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { useMemo } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { useVoyantFinanceContext } from "../index.js"
import type { TaxesPageApi, TaxesPageProps } from "./taxes-page/shared.js"
import { createTaxesPageApi } from "./taxes-page/shared.js"

type InvoicingMode = "direct" | "proforma-first"
type FxReferenceSource = "ecb" | "bnr"

/**
 * Dedicated Invoicing settings page. Owns the operator's invoicing
 * mode and official FX reference-rate source. Both read/write the
 * shared finance `/v1/admin/bookings/tax-settings` GET/PATCH surface —
 * the storage row is shared with the Taxes settings; the split here is
 * presentational.
 */
export function InvoicingPage({ api: apiProp }: TaxesPageProps = {}) {
  if (apiProp) return <InvoicingPageContent api={apiProp} />
  return <InvoicingPageWithDefaultApi />
}

function InvoicingPageWithDefaultApi() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const api = useMemo(() => createTaxesPageApi(baseUrl, fetcher), [baseUrl, fetcher])
  return <InvoicingPageContent api={api} />
}

function InvoicingPageContent({ api }: { api: TaxesPageApi }) {
  const messages = useFinanceUiMessagesOrDefault()
  const invoicingMessages = messages.invoicingPage
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ["booking-tax-settings"],
    queryFn: () =>
      api.get<{
        data: {
          invoicingMode: InvoicingMode
          fxReferenceSource: FxReferenceSource
        }
      }>("/v1/admin/bookings/tax-settings"),
  })
  const invoicingModeMutation = useMutation({
    mutationFn: (invoicingMode: InvoicingMode) =>
      api.patch("/v1/admin/bookings/tax-settings", { invoicingMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["booking-tax-settings"] })
    },
  })
  const fxReferenceSourceMutation = useMutation({
    mutationFn: (fxReferenceSource: FxReferenceSource) =>
      api.patch("/v1/admin/bookings/tax-settings", { fxReferenceSource }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["booking-tax-settings"] })
    },
  })
  const invoicingMode = settingsQuery.data?.data.invoicingMode ?? "proforma-first"
  const fxReferenceSource = settingsQuery.data?.data.fxReferenceSource ?? "ecb"
  // Both selects PATCH the same settings row (merge-on-read server side),
  // so while either write is in flight the other control must not fire a
  // concurrent PATCH that could clobber it.
  const settingsBusy =
    settingsQuery.isPending ||
    invoicingModeMutation.isPending ||
    fxReferenceSourceMutation.isPending

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{invoicingMessages.title}</h2>
        <p className="text-sm text-muted-foreground">{invoicingMessages.description}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-6 text-card-foreground shadow-sm">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {invoicingMessages.invoicingModeTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {invoicingMessages.invoicingModeDescription}
          </p>
        </div>
        <div className="max-w-sm">
          <Select
            value={invoicingMode}
            onValueChange={(value) => {
              if (value === "direct" || value === "proforma-first") {
                invoicingModeMutation.mutate(value)
              }
            }}
            disabled={settingsBusy}
          >
            <SelectTrigger id="invoicing-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proforma-first">
                {invoicingMessages.invoicingModeProformaFirst}
              </SelectItem>
              <SelectItem value="direct">{invoicingMessages.invoicingModeDirect}</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {invoicingMode === "direct"
              ? invoicingMessages.invoicingModeDirectHint
              : invoicingMessages.invoicingModeProformaFirstHint}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-6 text-card-foreground shadow-sm">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {invoicingMessages.fxReferenceSourceTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {invoicingMessages.fxReferenceSourceDescription}
          </p>
        </div>
        <div className="max-w-sm">
          <Select
            value={fxReferenceSource}
            onValueChange={(value) => {
              if (value === "ecb" || value === "bnr") {
                fxReferenceSourceMutation.mutate(value)
              }
            }}
            disabled={settingsBusy}
          >
            <SelectTrigger id="fx-reference-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ecb">{invoicingMessages.fxReferenceSourceEcb}</SelectItem>
              <SelectItem value="bnr">{invoicingMessages.fxReferenceSourceBnr}</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {fxReferenceSource === "bnr"
              ? invoicingMessages.fxReferenceSourceBnrHint
              : invoicingMessages.fxReferenceSourceEcbHint}
          </p>
        </div>
      </div>
    </div>
  )
}

export type {
  TaxesPageApi as InvoicingPageApi,
  TaxesPageProps as InvoicingPageProps,
} from "./taxes-page/shared.js"
