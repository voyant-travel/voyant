"use client"

import type { ReactNode } from "react"

import { InvoiceActionLedgerCard } from "./invoice-action-ledger-card.js"
import { InvoiceDetailPage, type InvoiceDetailPageProps } from "./invoice-detail-page.js"

export interface InvoiceDetailPageWithActionLedgerProps extends InvoiceDetailPageProps {
  actionLedgerContent?: ReactNode
}

export function InvoiceDetailPageWithActionLedger({
  actionLedgerContent,
  slots,
  ...props
}: InvoiceDetailPageWithActionLedgerProps) {
  const ledgerContent = actionLedgerContent ?? (
    <InvoiceActionLedgerCard key={props.id} invoiceId={props.id} />
  )

  return (
    <InvoiceDetailPage
      {...props}
      slots={{
        ...slots,
        afterNotes: (
          <>
            {slots?.afterNotes}
            {ledgerContent}
          </>
        ),
      }}
    />
  )
}
