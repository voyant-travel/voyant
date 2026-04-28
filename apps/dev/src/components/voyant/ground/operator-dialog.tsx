import {
  type CreateGroundOperatorInput,
  type GroundOperatorRecord,
  type UpdateGroundOperatorInput,
  useGroundOperatorMutation,
} from "@voyantjs/ground-react"
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"

type SupplierRef = { id: string; name: string; code?: string | null }
type FacilityRef = { id: string; name: string; code?: string | null; city?: string | null }

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  operator?: GroundOperatorRecord
  onSuccess?: (operator: GroundOperatorRecord) => void
}

export function OperatorDialog({ open, onOpenChange, operator, onSuccess }: Props) {
  const isEditing = Boolean(operator)
  const { create, update } = useGroundOperatorMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      supplierId: "",
      facilityId: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && operator) {
      form.reset({
        name: operator.name,
        code: operator.code ?? "",
        supplierId: operator.supplierId ?? "",
        facilityId: operator.facilityId ?? "",
        active: operator.active,
        notes: operator.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        name: "",
        code: "",
        supplierId: "",
        facilityId: "",
        active: true,
        notes: "",
      })
    }
  }, [form, open, operator])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateGroundOperatorInput | UpdateGroundOperatorInput = {
      name: values.name,
      code: values.code || null,
      supplierId: values.supplierId || null,
      facilityId: values.facilityId || null,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: operator!.id, input: payload })
      : await create.mutateAsync(payload as CreateGroundOperatorInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Operator" : "Add Operator"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Istanbul Transfer Co." />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="istanbul-transfer" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Supplier (optional)</Label>
              <EntityCombobox<SupplierRef>
                value={form.watch("supplierId") ?? null}
                onChange={(id) => form.setValue("supplierId", id)}
                endpoint="/v1/suppliers"
                detailEndpoint="/v1/suppliers/:id"
                queryKey={["suppliers", "picker"]}
                getLabel={(supplier) => supplier.name}
                getSecondary={(supplier) => supplier.code ?? undefined}
                placeholder="Search suppliers…"
                emptyText="No suppliers found."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Facility (optional)</Label>
              <EntityCombobox<FacilityRef>
                value={form.watch("facilityId") ?? null}
                onChange={(id) => form.setValue("facilityId", id)}
                endpoint="/v1/facilities/facilities"
                detailEndpoint="/v1/facilities/facilities/:id"
                queryKey={["facilities", "picker"]}
                getLabel={(facility) => facility.name}
                getSecondary={(facility) =>
                  [facility.code, facility.city].filter(Boolean).join(" · ") || undefined
                }
                placeholder="Search facilities…"
                emptyText="No facilities found."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(value) => form.setValue("active", value)}
              />
              <Label>Active</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Operator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
