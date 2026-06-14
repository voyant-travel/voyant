"use client"

import { Button } from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ExternalLink, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useFinanceUiI18nOrDefault, useFinanceUiMessagesOrDefault } from "../../i18n/index.js"

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface MoneyProps {
  cents: number
  currency: string
}

export interface InvoiceSectionProps {
  dataSlot: string
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function InvoiceSection({
  dataSlot,
  title,
  action,
  children,
  className,
}: InvoiceSectionProps) {
  return (
    <section data-slot={dataSlot} className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Money({ cents, currency }: MoneyProps) {
  const { formatCurrency } = useFinanceUiI18nOrDefault()

  return <span className="font-mono">{formatCurrency(cents / 100, currency)}</span>
}

export interface DetailRowProps {
  label: string
  children: ReactNode
}

export function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

export interface DetailLinkProps {
  label: string
  actionLabel: string
  onClick: () => void
  disabled?: boolean
}

export function DetailLink({ label, actionLabel, onClick, disabled }: DetailLinkProps) {
  if (disabled) return label

  return (
    <Button type="button" variant="link" className="h-auto p-0" onClick={onClick}>
      {label}
      <ExternalLink className="ml-1 size-3" aria-label={actionLabel} />
    </Button>
  )
}

export interface EmptyRowProps {
  children: ReactNode
}

export function EmptyRow({ children }: EmptyRowProps) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function LoadingRow() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

export function InvoiceDetailLoading({ className }: { className?: string }) {
  const messages = useFinanceUiMessagesOrDefault()

  return (
    <div className={cn("flex min-h-48 items-center justify-center", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {messages.invoiceDetailPage.states.loading}
      </div>
    </div>
  )
}

export function InvoiceDetailState({
  className,
  message,
  onBack,
}: {
  className?: string
  message: string
  onBack?: () => void
}) {
  const messages = useFinanceUiMessagesOrDefault()

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
      <p className="text-muted-foreground">{message}</p>
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          {messages.invoiceDetailPage.actions.back}
        </Button>
      ) : null}
    </div>
  )
}

export function formatPaymentMethod(
  method: string,
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  if (method in messages.common.paymentMethodLabels) {
    return messages.common.paymentMethodLabels[
      method as keyof typeof messages.common.paymentMethodLabels
    ]
  }

  if (method in messages.common.supplierPaymentMethodLabels) {
    return messages.common.supplierPaymentMethodLabels[
      method as keyof typeof messages.common.supplierPaymentMethodLabels
    ]
  }

  return method.replace(/_/g, " ")
}

export const invoiceStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  pending_external_allocation: "outline",
  issued: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "secondary",
}

export const invoiceTypeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  invoice: "default",
  proforma: "outline",
  credit_note: "destructive",
}

export const paymentStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

export const creditNoteStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  issued: "secondary",
  applied: "default",
}
