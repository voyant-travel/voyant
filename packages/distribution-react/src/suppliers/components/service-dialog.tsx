"use client"

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
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import { SERVICE_TYPES, type SupplierService, useSupplierServiceMutation } from "../index.js"

function getServiceSchema(messages: ReturnType<typeof useSuppliersUiMessagesOrDefault>) {
  return z.object({
    serviceType: z.enum(["accommodation", "transfer", "experience", "guide", "meal", "other"]),
    name: z.string().min(1, messages.dialogs.service.validationNameRequired),
    description: z.string().optional().nullable(),
    duration: z.string().optional().nullable(),
    capacity: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    active: z.boolean().default(true),
  })
}

export type ServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  service?: SupplierService
  onSuccess?: (service: SupplierService) => void
}

export function ServiceDialog({
  open,
  onOpenChange,
  supplierId,
  service,
  onSuccess,
}: ServiceDialogProps) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.service
  const schema = React.useMemo(() => getServiceSchema(messages), [messages])
  const serviceMutation = useSupplierServiceMutation(supplierId)
  const isEditing = !!service

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceType: "accommodation",
      name: "",
      description: "",
      duration: "",
      capacity: "",
      active: true,
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      serviceType: service?.serviceType ?? "accommodation",
      name: service?.name ?? "",
      description: service?.description ?? "",
      duration: service?.duration ?? "",
      capacity: service?.capacity ?? "",
      active: service?.active ?? true,
    })
  }, [form, open, service])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      serviceType: values.serviceType,
      name: values.name,
      description: values.description || null,
      duration: values.duration || null,
      capacity: values.capacity && typeof values.capacity === "number" ? values.capacity : null,
      active: values.active,
    }

    const saved = isEditing
      ? await serviceMutation.update.mutateAsync({ serviceId: service.id, input })
      : await serviceMutation.create.mutateAsync(input)
    onSuccess?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialog.serviceTypeLabel}</Label>
              <Select
                value={form.watch("serviceType")}
                onValueChange={(value) =>
                  form.setValue("serviceType", value as z.input<typeof schema>["serviceType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {messages.common.serviceTypeLabels[type.value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label={dialog.nameLabel} error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder={dialog.namePlaceholder} />
            </Field>
            <Field label={dialog.descriptionLabel}>
              <Textarea
                {...form.register("description")}
                placeholder={dialog.descriptionPlaceholder}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.durationLabel}>
                <Input {...form.register("duration")} placeholder={dialog.durationPlaceholder} />
              </Field>
              <Field label={dialog.capacityLabel}>
                <Input
                  {...form.register("capacity")}
                  type="number"
                  min="1"
                  placeholder={dialog.capacityPlaceholder}
                />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(value) => form.setValue("active", value)}
              />
              <Label>{dialog.activeLabel}</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? messages.common.save : messages.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
