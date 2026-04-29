"use client"

import {
  type CreateGroundOperatorInput,
  type GroundOperatorRecord,
  type UpdateGroundOperatorInput,
  useGroundOperatorMutation,
} from "@voyantjs/ground-react"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryGroundMessagesOrDefault } from "./i18n"

type SupplierRef = { id: string; name: string; code?: string | null }
type FacilityRef = { id: string; name: string; code?: string | null; city?: string | null }

export interface OperatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operator?: GroundOperatorRecord
  onSuccess?: (operator: GroundOperatorRecord) => void
}

export function OperatorDialog({ open, onOpenChange, operator, onSuccess }: OperatorDialogProps) {
  const messages = useRegistryGroundMessagesOrDefault()
  const dialogMessages = messages.operatorDialog
  const isEditing = Boolean(operator)
  const { create, update } = useGroundOperatorMutation()
  const formSchema = z.object({
    name: z.string().min(1, dialogMessages.errors.nameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    supplierId: z.string().optional().nullable(),
    facilityId: z.string().optional().nullable(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>
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
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.addTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.code}</Label>
                <Input {...form.register("code")} placeholder={dialogMessages.placeholders.code} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.supplier}</Label>
              <EntityCombobox<SupplierRef>
                value={form.watch("supplierId") ?? null}
                onChange={(id) => form.setValue("supplierId", id)}
                endpoint="/v1/suppliers"
                detailEndpoint="/v1/suppliers/:id"
                queryKey={["suppliers", "picker"]}
                getLabel={(supplier) => supplier.name}
                getSecondary={(supplier) => supplier.code ?? undefined}
                placeholder={dialogMessages.placeholders.supplier}
                emptyText={dialogMessages.placeholders.supplierEmpty}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.facility}</Label>
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
                placeholder={dialogMessages.placeholders.facility}
                emptyText={dialogMessages.placeholders.facilityEmpty}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(value) => form.setValue("active", value)}
              />
              <Label>{dialogMessages.fields.active}</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
