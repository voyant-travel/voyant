"use client"

import {
  type CreateGroundDriverInput,
  type GroundDriverRecord,
  type UpdateGroundDriverInput,
  useGroundDriverMutation,
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

type ResourceRef = { id: string; name: string; kind?: string | null }
type OperatorRef = { id: string; name: string; code?: string | null }

export interface DriverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: GroundDriverRecord
  onSuccess?: (driver: GroundDriverRecord) => void
}

export function DriverDialog({ open, onOpenChange, driver, onSuccess }: DriverDialogProps) {
  const messages = useRegistryGroundMessagesOrDefault()
  const dialogMessages = messages.driverDialog
  const isEditing = Boolean(driver)
  const { create, update } = useGroundDriverMutation()
  const formSchema = z.object({
    resourceId: z.string().min(1, dialogMessages.errors.resourceRequired),
    operatorId: z.string().optional().nullable(),
    licenseNumber: z.string().max(100).optional().nullable(),
    spokenLanguages: z.string(),
    isGuide: z.boolean(),
    isMeetAndGreetCapable: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resourceId: "",
      operatorId: "",
      licenseNumber: "",
      spokenLanguages: "",
      isGuide: false,
      isMeetAndGreetCapable: false,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && driver) {
      form.reset({
        resourceId: driver.resourceId,
        operatorId: driver.operatorId ?? "",
        licenseNumber: driver.licenseNumber ?? "",
        spokenLanguages: driver.spokenLanguages.join(", "),
        isGuide: driver.isGuide,
        isMeetAndGreetCapable: driver.isMeetAndGreetCapable,
        active: driver.active,
        notes: driver.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        resourceId: "",
        operatorId: "",
        licenseNumber: "",
        spokenLanguages: "",
        isGuide: false,
        isMeetAndGreetCapable: false,
        active: true,
        notes: "",
      })
    }
  }, [driver, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateGroundDriverInput | UpdateGroundDriverInput = {
      resourceId: values.resourceId,
      operatorId: values.operatorId || null,
      licenseNumber: values.licenseNumber || null,
      spokenLanguages: values.spokenLanguages
        .split(",")
        .map((language) => language.trim())
        .filter((language) => language.length > 0),
      isGuide: values.isGuide,
      isMeetAndGreetCapable: values.isMeetAndGreetCapable,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: driver!.id, input: payload })
      : await create.mutateAsync(payload as CreateGroundDriverInput)

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
                <Label>{dialogMessages.fields.resource}</Label>
                <EntityCombobox<ResourceRef>
                  value={form.watch("resourceId") || null}
                  onChange={(id) => form.setValue("resourceId", id ?? "")}
                  endpoint="/v1/resources/resources"
                  detailEndpoint="/v1/resources/resources/:id"
                  queryKey={["resources", "picker"]}
                  getLabel={(resource) => resource.name}
                  getSecondary={(resource) => resource.kind ?? undefined}
                  placeholder={dialogMessages.placeholders.resource}
                  emptyText={dialogMessages.placeholders.resourceEmpty}
                />
                {form.formState.errors.resourceId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.resourceId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.operator}</Label>
                <EntityCombobox<OperatorRef>
                  value={form.watch("operatorId") ?? null}
                  onChange={(id) => form.setValue("operatorId", id)}
                  endpoint="/v1/ground/operators"
                  detailEndpoint="/v1/ground/operators/:id"
                  queryKey={["ground", "operators", "picker"]}
                  getLabel={(groundOperator) => groundOperator.name}
                  getSecondary={(groundOperator) => groundOperator.code ?? undefined}
                  placeholder={dialogMessages.placeholders.operator}
                  emptyText={dialogMessages.placeholders.operatorEmpty}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.licenseNumber}</Label>
              <Input {...form.register("licenseNumber")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.spokenLanguages}</Label>
              <Input
                {...form.register("spokenLanguages")}
                placeholder={dialogMessages.placeholders.spokenLanguages}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isGuide")}
                  onCheckedChange={(value) => form.setValue("isGuide", value)}
                />
                <Label>{dialogMessages.fields.guide}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isMeetAndGreetCapable")}
                  onCheckedChange={(value) => form.setValue("isMeetAndGreetCapable", value)}
                />
                <Label>{dialogMessages.fields.meetAndGreet}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>{dialogMessages.fields.active}</Label>
              </div>
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
