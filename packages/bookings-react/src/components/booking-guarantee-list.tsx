"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type BookingGuaranteeRecord,
  useBookingGuaranteeMutation,
  useBookingGuarantees,
} from "@voyant-travel/finance-react"
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
} from "@voyant-travel/ui/components"
import { DataTable } from "@voyant-travel/ui/components/data-table"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingGuaranteeDialog } from "./booking-guarantee-dialog.js"
import { IconActionButton } from "./icon-action-button.js"
import { StatusBadge } from "./status-badge.js"

export interface BookingGuaranteeListProps {
  bookingId: string
}

export function BookingGuaranteeList({ bookingId }: BookingGuaranteeListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingGuaranteeRecord | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = React.useState<BookingGuaranteeRecord | null>(null)
  const { data } = useBookingGuarantees(bookingId)
  const { remove } = useBookingGuaranteeMutation(bookingId)
  const { formatCurrency, formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const t = messages.bookingGuaranteeList
  const deleteMessages = t.actions.deleteConfirm

  const guarantees = data?.data ?? []

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await remove.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const columns = React.useMemo<ColumnDef<BookingGuaranteeRecord>[]>(
    () => [
      {
        accessorKey: "guaranteeType",
        header: t.columns.type,
        cell: ({ row }) =>
          messages.bookingGuaranteeDialog.guaranteeTypeLabels[row.original.guaranteeType],
      },
      {
        accessorKey: "amountCents",
        header: t.columns.amount,
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.amountCents == null || !row.original.currency
              ? t.values.amountUnavailable
              : formatCurrency(row.original.amountCents / 100, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t.columns.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {messages.bookingGuaranteeDialog.guaranteeStatusLabels[row.original.status]}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "provider",
        header: t.columns.provider,
        cell: ({ row }) => row.original.provider ?? t.values.providerUnavailable,
      },
      {
        accessorKey: "referenceNumber",
        header: t.columns.reference,
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate font-mono text-xs">
            {row.original.referenceNumber ?? t.values.referenceUnavailable}
          </span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: t.columns.expires,
        cell: ({ row }) =>
          row.original.expiresAt ? formatDate(row.original.expiresAt) : t.values.expiresUnavailable,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconActionButton
              label={t.actions.editGuarantee}
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation()
                setEditing(row.original)
                setDialogOpen(true)
              }}
            />
            <IconActionButton
              label={t.actions.deleteGuarantee}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row.original)
              }}
            />
          </div>
        ),
      },
    ],
    [formatCurrency, formatDate, messages, t],
  )

  return (
    <div data-slot="booking-guarantee-list" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" />
          {t.title}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.addGuarantee}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={guarantees}
        emptyMessage={t.empty}
        showPagination={false}
      />

      <BookingGuaranteeDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) setEditing(undefined)
        }}
        bookingId={bookingId}
        guarantee={editing}
        onSuccess={() => setEditing(undefined)}
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
