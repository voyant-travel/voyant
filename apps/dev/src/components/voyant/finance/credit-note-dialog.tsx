import { useInvoiceCreditNoteMutation } from "@voyantjs/finance-react"
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
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const creditNoteFormSchema = z.object({
  creditNoteNumber: z.string().min(1, "Credit note number is required"),
  amountCents: z.coerce.number().int().min(1, "Amount must be at least 1"),
  currency: z.string().min(3).max(3),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional().nullable(),
})

type CreditNoteFormValues = z.input<typeof creditNoteFormSchema>
type CreditNoteFormOutput = z.output<typeof creditNoteFormSchema>

export interface CreditNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceCurrency: string
  onSuccess?: () => void
}

function generateCreditNoteNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `CN-${y}-${seq}`
}

export function CreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceCurrency,
  onSuccess,
}: CreditNoteDialogProps) {
  const { create } = useInvoiceCreditNoteMutation(invoiceId)

  const form = useForm<CreditNoteFormValues, unknown, CreditNoteFormOutput>({
    resolver: zodResolver(creditNoteFormSchema),
    defaultValues: {
      creditNoteNumber: "",
      amountCents: 0,
      currency: invoiceCurrency,
      reason: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        creditNoteNumber: generateCreditNoteNumber(),
        amountCents: 0,
        currency: invoiceCurrency,
        reason: "",
        notes: "",
      })
    }
  }, [open, invoiceCurrency, form])

  const onSubmit = async (values: CreditNoteFormOutput) => {
    await create.mutateAsync({
      creditNoteNumber: values.creditNoteNumber,
      amountCents: values.amountCents,
      currency: values.currency,
      reason: values.reason,
      notes: values.notes || null,
    })

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Credit Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Credit Note Number</Label>
                <Input {...form.register("creditNoteNumber")} placeholder="CN-2025-1234" />
                {form.formState.errors.creditNoteNumber ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.creditNoteNumber.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
                <Input
                  {...form.register("currency")}
                  placeholder="EUR"
                  maxLength={3}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Amount (cents)</Label>
              <Input {...form.register("amountCents")} type="number" min="1" />
              {form.formState.errors.amountCents ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amountCents.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Reason</Label>
              <Textarea {...form.register("reason")} placeholder="Reason for credit note..." />
              {form.formState.errors.reason ? (
                <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Additional notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Credit Note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
