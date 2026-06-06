import {
  type SupplierInvoiceRecord,
  type SupplierInvoiceStatus,
  useSupplierInvoiceMutation,
} from "@voyantjs/finance-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { useEffect, useState } from "react"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"

const STATUS_ORDER: SupplierInvoiceStatus[] = [
  "draft",
  "received",
  "approved",
  "partially_paid",
  "paid",
  "disputed",
  "void",
]

export interface SupplierInvoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present → edit mode; absent → create mode. */
  invoice?: SupplierInvoiceRecord
  onSaved?: (id: string) => void
}

interface FormState {
  supplierInvoiceNo: string
  supplierId: string
  status: SupplierInvoiceStatus
  currency: string
  issueDate: string
  dueDate: string
  internalRef: string
  notes: string
}

function seed(invoice?: SupplierInvoiceRecord): FormState {
  return {
    supplierInvoiceNo: invoice?.supplierInvoiceNo ?? "",
    supplierId: invoice?.supplierId ?? "",
    status: invoice?.status ?? "received",
    currency: invoice?.currency ?? "EUR",
    issueDate: invoice?.issueDate ?? "",
    dueDate: invoice?.dueDate ?? "",
    internalRef: invoice?.internalRef ?? "",
    notes: invoice?.notes ?? "",
  }
}

export function SupplierInvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: SupplierInvoiceFormDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const t = messages.supplierInvoiceDetail.form
  const statusLabels = messages.supplierInvoicesPage.statusLabels
  const { create, update } = useSupplierInvoiceMutation()
  const isEdit = Boolean(invoice)
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(() => seed(invoice))

  // Re-seed when the dialog opens or the target invoice changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-seed on open/target change only
  useEffect(() => {
    if (open) setForm(seed(invoice))
  }, [open, invoice?.id])

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const canSave = form.supplierInvoiceNo.trim() && form.supplierId.trim() && form.issueDate

  const submit = () => {
    if (!canSave) return
    const payload = {
      supplierId: form.supplierId.trim(),
      supplierInvoiceNo: form.supplierInvoiceNo.trim(),
      status: form.status,
      currency: form.currency.trim().toUpperCase(),
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      internalRef: form.internalRef.trim() || null,
      notes: form.notes.trim() || null,
    }
    const onDone = (id: string) => {
      onOpenChange(false)
      onSaved?.(id)
    }
    if (invoice) {
      update.mutate(
        { id: invoice.id, input: payload },
        { onSuccess: (row) => onDone(row?.id ?? invoice.id) },
      )
    } else {
      create.mutate(payload, { onSuccess: (row) => row && onDone(row.id) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t.editTitle : messages.supplierInvoicesPage.recordInvoice}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <Field label={t.supplierInvoiceNo}>
            <Input
              value={form.supplierInvoiceNo}
              onChange={(e) => set({ supplierInvoiceNo: e.target.value })}
            />
          </Field>
          <Field label={t.supplierId}>
            <Input value={form.supplierId} onChange={(e) => set({ supplierId: e.target.value })} />
          </Field>
          <Field label={t.status}>
            <Select
              value={form.status}
              onValueChange={(v) => set({ status: (v as SupplierInvoiceStatus) ?? "received" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.currency}>
            <Input
              value={form.currency}
              maxLength={3}
              onChange={(e) => set({ currency: e.target.value })}
            />
          </Field>
          <Field label={t.issueDate}>
            <Input
              type="date"
              value={form.issueDate}
              onChange={(e) => set({ issueDate: e.target.value })}
            />
          </Field>
          <Field label={t.dueDate}>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => set({ dueDate: e.target.value })}
            />
          </Field>
          <Field label={t.internalRef} className="col-span-2">
            <Input
              value={form.internalRef}
              onChange={(e) => set({ internalRef: e.target.value })}
            />
          </Field>
          <Field label={t.notes} className="col-span-2">
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" disabled={!canSave || pending} onClick={submit}>
            {pending ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
