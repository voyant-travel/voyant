"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  ConfirmActionButton,
  Textarea,
} from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowLeft, ArrowRightLeft, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../../i18n/index.js"
import type { InvoiceRecord } from "../../index.js"
import { invoiceStatusVariant, invoiceTypeVariant } from "./primitives.js"

export interface InvoiceDetailHeaderProps {
  invoice: InvoiceRecord
  onBack?: () => void
  onEdit: () => void
  onConvert?: () => Promise<void>
  onVoid: (reason?: string | null) => Promise<void>
  onDelete: () => Promise<void>
  convertPending?: boolean
  voidPending?: boolean
  deletePending?: boolean
  className?: string
}

export function InvoiceDetailHeader({
  invoice,
  onBack,
  onEdit,
  onConvert,
  onVoid,
  onDelete,
  convertPending,
  voidPending,
  deletePending,
  className,
}: InvoiceDetailHeaderProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")
  const canDelete = invoice.status === "draft"
  const canVoid = ["pending_external_allocation", "issued", "overdue"].includes(invoice.status)
  const invoiceType = invoice.invoiceType
  const canConvert = Boolean(onConvert && invoiceType === "proforma" && invoice.status !== "void")

  return (
    <div
      data-slot="invoice-detail-header"
      className={cn("flex flex-col gap-4 md:flex-row md:items-start", className)}
    >
      {onBack ? (
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="sr-only">{detail.actions.back}</span>
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <Badge variant={invoiceStatusVariant[invoice.status] ?? "secondary"}>
            {messages.common.invoiceStatusLabels[invoice.status]}
          </Badge>
          {invoiceType ? (
            <Badge
              data-slot="invoice-type-badge"
              data-invoice-type={invoiceType}
              variant={invoiceTypeVariant[invoiceType] ?? "secondary"}
            >
              {detail.invoiceTypeLabels[invoiceType]}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate font-mono text-muted-foreground text-sm">
          {invoice.invoiceNumber}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {detail.fields.booking}: {invoice.bookingId}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {canConvert ? (
          <AlertDialog>
            <AlertDialogTrigger
              disabled={convertPending}
              render={<Button type="button" variant="outline" size="sm" />}
            >
              <ArrowRightLeft className="size-4" aria-hidden="true" />
              {detail.actions.convertToInvoice}
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>{detail.actions.convertToInvoiceTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {detail.actions.convertToInvoiceDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={convertPending}>
                  {messages.common.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={convertPending}
                  onClick={() => {
                    if (onConvert) void onConvert()
                  }}
                >
                  {convertPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {detail.actions.convertToInvoice}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
          {detail.actions.edit}
        </Button>
        <AlertDialog
          open={voidDialogOpen}
          onOpenChange={(open) => {
            setVoidDialogOpen(open)
            if (!open) setVoidReason("")
          }}
        >
          <AlertDialogTrigger
            disabled={!canVoid || voidPending}
            render={<Button type="button" variant="outline" size="sm" />}
          >
            {detail.actions.void}
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{detail.actions.voidTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {canVoid ? detail.actions.voidDescription : detail.actions.voidUnavailable}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder={detail.actions.voidReasonPlaceholder}
              className="min-h-24"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={voidPending}>{messages.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={voidPending}
                onClick={() => {
                  void onVoid(voidReason.trim() || null)
                  setVoidDialogOpen(false)
                  setVoidReason("")
                }}
              >
                {voidPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {detail.actions.void}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ConfirmActionButton
          buttonLabel={detail.actions.delete}
          confirmLabel={detail.actions.delete}
          cancelLabel={messages.common.cancel}
          title={detail.actions.deleteTitle}
          description={
            canDelete ? detail.actions.deleteDescription : detail.actions.deleteOnlyDraft
          }
          variant="destructive"
          confirmVariant="destructive"
          disabled={!canDelete || deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}
