"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  type BookingPaymentScheduleRecord,
  financeQueryKeys,
  useBookingPaymentScheduleMutation,
  useBookingPaymentSchedules,
  useInvoiceMutation,
  useInvoices,
} from "@voyantjs/finance-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyantjs/ui/components/tooltip"
import { CalendarClock, FileText, Loader2, Pencil, Plus, Receipt, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import type { BookingsUiMessages } from "../i18n/messages.js"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { useBooking } from "../index.js"
import { BookingPaymentScheduleDialog } from "./booking-payment-schedule-dialog.js"
import { IconActionButton } from "./icon-action-button.js"
import { StatusBadge } from "./status-badge.js"

type IssueDocumentAllocationErrorCode =
  keyof BookingsUiMessages["bookingPaymentScheduleList"]["actions"]["issueDocumentErrors"]

const issueDocumentAllocationErrorCodes: IssueDocumentAllocationErrorCode[] = [
  "invoice_number_series_not_found",
  "invoice_number_series_inactive",
  "invoice_number_series_scope_mismatch",
  "no_active_series_for_scope",
]

function isIssueDocumentAllocationErrorCode(
  value: unknown,
): value is IssueDocumentAllocationErrorCode {
  return (
    typeof value === "string" &&
    issueDocumentAllocationErrorCodes.includes(value as IssueDocumentAllocationErrorCode)
  )
}

function extractIssueDocumentAllocationErrorCode(
  error: unknown,
): IssueDocumentAllocationErrorCode | null {
  if (typeof error === "object" && error !== null && "body" in error) {
    const body = (error as { body?: unknown }).body
    if (typeof body === "object" && body !== null && "error" in body) {
      const apiError = (body as { error?: unknown }).error
      if (isIssueDocumentAllocationErrorCode(apiError)) return apiError
    }
  }

  if (error instanceof Error && isIssueDocumentAllocationErrorCode(error.message)) {
    return error.message
  }

  return null
}

function getIssueDocumentErrorMessage(error: unknown, messages: BookingsUiMessages): string | null {
  const code = extractIssueDocumentAllocationErrorCode(error)
  if (code) {
    return messages.bookingPaymentScheduleList.actions.issueDocumentErrors[code]
  }
  return error instanceof Error ? error.message : null
}

export interface BookingPaymentScheduleListProps {
  /**
   * When set, the Add schedule button renders disabled and its tooltip
   * shows this reason (e.g. "Booking is fully paid.").
   */
  addScheduleDisabledReason?: string | null
  bookingId: string
}

export function BookingPaymentScheduleList({
  bookingId,
  addScheduleDisabledReason,
}: BookingPaymentScheduleListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingPaymentScheduleRecord | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = React.useState<BookingPaymentScheduleRecord | null>(null)
  const [generatingInvoiceForId, setGeneratingInvoiceForId] = React.useState<string | null>(null)
  const { data } = useBookingPaymentSchedules(bookingId)
  const { remove } = useBookingPaymentScheduleMutation(bookingId)
  const { data: bookingData } = useBooking(bookingId)
  const booking = bookingData?.data ?? null
  // Track which schedules already have an invoice / proforma so the
  // per-row action menu can hide the irrelevant choices and the new
  // Invoice column can link to the doc.
  const { data: invoicesData } = useInvoices({ bookingId, limit: 50 })
  type ScheduleDocs = {
    invoice: { id: string; invoiceNumber: string } | null
    proforma: { id: string; invoiceNumber: string } | null
  }
  const docsByScheduleId = React.useMemo(() => {
    const map = new Map<string, ScheduleDocs>()
    const invoices = invoicesData?.data ?? []
    for (const invoice of invoices) {
      if (invoice.status === "void") continue
      const scheduleIds =
        (invoice as { bookingPaymentScheduleIds?: string[] }).bookingPaymentScheduleIds ?? []
      for (const scheduleId of scheduleIds) {
        const existing = map.get(scheduleId) ?? { invoice: null, proforma: null }
        const ref = { id: invoice.id, invoiceNumber: invoice.invoiceNumber }
        if (invoice.invoiceType === "proforma") {
          if (!existing.proforma) existing.proforma = ref
        } else if (invoice.invoiceType !== "credit_note") {
          if (!existing.invoice) existing.invoice = ref
        }
        map.set(scheduleId, existing)
      }
    }
    return map
  }, [invoicesData])
  const { createFromBooking: createInvoiceFromBooking, render: renderInvoice } =
    useInvoiceMutation()
  const queryClient = useQueryClient()
  const { formatCurrency, formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const t = messages.bookingPaymentScheduleList
  const deleteMessages = t.actions.deleteConfirm

  const schedules = data?.data ?? []

  const handleGenerateInvoice = React.useCallback(
    async (schedule: BookingPaymentScheduleRecord, invoiceType: "invoice" | "proforma") => {
      if (!booking) return
      setGeneratingInvoiceForId(schedule.id)
      try {
        const todayIso = new Date().toISOString().slice(0, 10)
        const dueIso = schedule.dueDate || todayIso
        const invoice = await createInvoiceFromBooking.mutateAsync({
          bookingId: booking.id,
          bookingPaymentScheduleId: schedule.id,
          issueDate: todayIso,
          dueDate: dueIso,
          notes: schedule.notes ?? null,
          invoiceType,
        })
        await renderInvoice.mutateAsync({ id: invoice.id, input: { format: "pdf" } })
        await queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
        toast.success(t.actions.issueDocumentSuccess)
      } catch (err) {
        const errorMessage = getIssueDocumentErrorMessage(err, messages)
        toast.error(
          errorMessage
            ? `${t.actions.issueDocumentFailure}: ${errorMessage}`
            : t.actions.issueDocumentFailure,
        )
      } finally {
        setGeneratingInvoiceForId(null)
      }
    },
    [booking, createInvoiceFromBooking, renderInvoice, queryClient, t, messages],
  )

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await remove.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const columns = React.useMemo<ColumnDef<BookingPaymentScheduleRecord>[]>(
    () => [
      {
        accessorKey: "dueDate",
        header: t.columns.dueDate,
        cell: ({ row }) =>
          row.original.dueDate
            ? formatDate(`${row.original.dueDate}T00:00:00`, { dateStyle: "medium" })
            : "—",
      },
      {
        accessorKey: "amountCents",
        header: t.columns.amount,
        cell: ({ row }) => (
          <span className="font-mono">
            {formatCurrency(row.original.amountCents / 100, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "scheduleType",
        header: t.columns.type,
        cell: ({ row }) =>
          messages.paymentScheduleDialog.scheduleTypeLabels[row.original.scheduleType],
      },
      {
        accessorKey: "status",
        header: t.columns.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {messages.paymentScheduleDialog.scheduleStatusLabels[row.original.status]}
          </StatusBadge>
        ),
      },
      {
        id: "invoice",
        header: t.columns.invoice,
        cell: ({ row }) => {
          const docs = docsByScheduleId.get(row.original.id)
          const doc = docs?.invoice ?? docs?.proforma ?? null
          if (!doc) return <span className="text-muted-foreground">—</span>
          return (
            <span className="font-mono text-xs">
              {doc.invoiceNumber}
              {docs?.proforma && !docs.invoice ? (
                <span className="ml-1 text-muted-foreground">({t.values.proformaSuffix})</span>
              ) : null}
            </span>
          )
        },
      },
      {
        accessorKey: "notes",
        header: t.columns.notes,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-muted-foreground">
            {row.original.notes ?? t.values.notesUnavailable}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const schedule = row.original
          const issuing = generatingInvoiceForId === schedule.id
          // Once a schedule is settled (paid / waived / cancelled / expired)
          // there's nothing left to bill, so hide the issue-document menu.
          const canIssue = schedule.status === "pending" || schedule.status === "due"
          const docs = docsByScheduleId.get(schedule.id)
          // Idempotency: a schedule already covered by a final invoice
          // accepts no more documents; a covering proforma blocks new
          // proformas (a final invoice path is still open via the
          // proforma's Convert action). A final invoice always wins
          // over a proforma in the same slot.
          const canIssueInvoice = canIssue && !docs?.invoice
          const canIssueProforma = canIssue && !docs?.invoice && !docs?.proforma
          const hasAnyIssueAction = canIssueInvoice || canIssueProforma
          return (
            <div className="flex items-center justify-end gap-1">
              {hasAnyIssueAction ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={!booking || issuing}
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.actions.issueDocument}
                        title={t.actions.issueDocument}
                      />
                    }
                  >
                    {issuing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Receipt className="h-3.5 w-3.5" />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canIssueInvoice ? (
                      <DropdownMenuItem
                        onClick={() => void handleGenerateInvoice(schedule, "invoice")}
                      >
                        <FileText className="h-4 w-4" />
                        {t.actions.issueInvoice}
                      </DropdownMenuItem>
                    ) : null}
                    {canIssueProforma ? (
                      <DropdownMenuItem
                        onClick={() => void handleGenerateInvoice(schedule, "proforma")}
                      >
                        <FileText className="h-4 w-4" />
                        {t.actions.issueProforma}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <IconActionButton
                label={t.actions.editSchedule}
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(schedule)
                  setDialogOpen(true)
                }}
              />
              <IconActionButton
                label={t.actions.deleteSchedule}
                icon={<Trash2 className="h-3.5 w-3.5" />}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(schedule)
                }}
              />
            </div>
          )
        },
      },
    ],
    [
      booking,
      formatCurrency,
      formatDate,
      generatingInvoiceForId,
      handleGenerateInvoice,
      messages,
      t,
      docsByScheduleId,
    ],
  )

  return (
    <div data-slot="booking-payment-schedule-list" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4" />
          {t.title}
        </h2>
        {addScheduleDisabledReason ? (
          <Tooltip>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: required so disabled-button tooltips remain keyboard-discoverable */}
            <TooltipTrigger render={<span tabIndex={0} className="inline-block" />}>
              <Button variant="outline" size="sm" disabled className="pointer-events-none">
                <Plus className="mr-2 h-4 w-4" />
                {t.addSchedule}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{addScheduleDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t.addSchedule}
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={schedules} emptyMessage={t.empty} showPagination={false} />

      <BookingPaymentScheduleDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        schedule={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteMessages.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteMessages.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {deleteMessages.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {deleteMessages.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
