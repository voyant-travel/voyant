import { type StayFolioRecord, useStayFolioMutation } from "@voyantjs/hospitality-react"
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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const STATUSES = ["open", "closed", "transferred", "void"] as const
type Status = (typeof STATUSES)[number]

const formSchema = z.object({
  stayOperationId: z.string().min(1, "Stay operation ID is required"),
  currencyCode: z.string().length(3, "3-letter currency code required"),
  status: z.enum(STATUSES),
  openedAt: z.string().optional().nullable(),
  closedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type StayFolioData = StayFolioRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  folio?: StayFolioData
  onSuccess: () => void
}

const toLocal = (iso: string | null): string => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocal = (local: string | null | undefined): string | null => {
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function StayFolioDialog({ open, onOpenChange, folio, onSuccess }: Props) {
  const isEditing = !!folio
  const { create, update } = useStayFolioMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stayOperationId: "",
      currencyCode: "USD",
      status: "open",
      openedAt: "",
      closedAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && folio) {
      form.reset({
        stayOperationId: folio.stayOperationId,
        currencyCode: folio.currencyCode,
        status: folio.status,
        openedAt: toLocal(folio.openedAt),
        closedAt: toLocal(folio.closedAt),
        notes: folio.notes ?? "",
      })
    } else if (open) {
      form.reset({
        stayOperationId: "",
        currencyCode: "USD",
        status: "open",
        openedAt: "",
        closedAt: "",
        notes: "",
      })
    }
  }, [open, folio, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      stayOperationId: values.stayOperationId,
      currencyCode: values.currencyCode,
      status: values.status,
      openedAt: fromLocal(values.openedAt),
      closedAt: fromLocal(values.closedAt),
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: folio.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Stay Folio" : "Add Stay Folio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Stay operation ID</Label>
              <Input
                {...form.register("stayOperationId")}
                placeholder="sop_…"
                disabled={isEditing}
              />
              {form.formState.errors.stayOperationId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.stayOperationId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Currency (ISO 4217)</Label>
                <Input {...form.register("currencyCode")} placeholder="USD" maxLength={3} />
                {form.formState.errors.currencyCode && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.currencyCode.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Opened at</Label>
                <Input {...form.register("openedAt")} type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Closed at</Label>
                <Input {...form.register("closedAt")} type="datetime-local" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Folio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
