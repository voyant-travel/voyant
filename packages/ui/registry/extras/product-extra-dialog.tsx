"use client"

import { type ProductExtraRecord, useProductExtraMutation } from "@voyantjs/extras-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryExtrasMessagesOrDefault } from "./i18n"

const selectionTypes = ["optional", "required", "default_selected", "unavailable"] as const

const pricingModes = [
  "included",
  "per_person",
  "per_booking",
  "quantity_based",
  "on_request",
  "free",
] as const

function createFormSchema(messages: ReturnType<typeof useRegistryExtrasMessagesOrDefault>) {
  return z.object({
    name: z.string().min(1, messages.productExtraDialog.validation.nameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    selectionType: z.enum(selectionTypes),
    pricingMode: z.enum(pricingModes),
    pricedPerPerson: z.boolean(),
    minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    defaultQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  extra?: ProductExtraRecord
  nextSortOrder?: number
  onSuccess?: (extra: ProductExtraRecord) => void
}

export function ProductExtraDialog({
  open,
  onOpenChange,
  productId,
  extra,
  nextSortOrder,
  onSuccess,
}: Props) {
  const messages = useRegistryExtrasMessagesOrDefault()
  const dialogMessages = messages.productExtraDialog
  const commonMessages = messages.common
  const formSchema = createFormSchema(messages)
  const isEditing = !!extra
  const { create, update } = useProductExtraMutation()

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      selectionType: "optional",
      pricingMode: "per_booking",
      pricedPerPerson: false,
      minQuantity: "",
      maxQuantity: "",
      defaultQuantity: "",
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && extra) {
      form.reset({
        name: extra.name,
        code: extra.code ?? "",
        description: extra.description ?? "",
        selectionType: extra.selectionType,
        pricingMode: extra.pricingMode,
        pricedPerPerson: extra.pricedPerPerson,
        minQuantity: extra.minQuantity ?? "",
        maxQuantity: extra.maxQuantity ?? "",
        defaultQuantity: extra.defaultQuantity ?? "",
        active: extra.active,
        sortOrder: extra.sortOrder,
      })
    } else if (open) {
      form.reset({
        name: "",
        code: "",
        description: "",
        selectionType: "optional",
        pricingMode: "per_booking",
        pricedPerPerson: false,
        minQuantity: "",
        maxQuantity: "",
        defaultQuantity: "",
        active: true,
        sortOrder: nextSortOrder ?? 0,
      })
    }
  }, [extra, form, nextSortOrder, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productId,
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      selectionType: values.selectionType,
      pricingMode: values.pricingMode,
      pricedPerPerson: values.pricedPerPerson,
      minQuantity: typeof values.minQuantity === "number" ? values.minQuantity : null,
      maxQuantity: typeof values.maxQuantity === "number" ? values.maxQuantity : null,
      defaultQuantity: typeof values.defaultQuantity === "number" ? values.defaultQuantity : null,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: extra.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titles.edit : dialogMessages.titles.create}
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
              <Label>{dialogMessages.fields.description}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={dialogMessages.placeholders.description}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.selectionType}</Label>
                <Select
                  items={selectionTypes.map((value) => ({
                    label: commonMessages.selectionTypeLabels[value],
                    value,
                  }))}
                  value={form.watch("selectionType")}
                  onValueChange={(value) =>
                    form.setValue("selectionType", value as FormValues["selectionType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectionTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {commonMessages.selectionTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.pricingMode}</Label>
                <Select
                  items={pricingModes.map((value) => ({
                    label: commonMessages.pricingModeLabels[value],
                    value,
                  }))}
                  value={form.watch("pricingMode")}
                  onValueChange={(value) =>
                    form.setValue("pricingMode", value as FormValues["pricingMode"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingModes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {commonMessages.pricingModeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.minQuantity}</Label>
                <Input {...form.register("minQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.maxQuantity}</Label>
                <Input {...form.register("maxQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.defaultQuantity}</Label>
                <Input {...form.register("defaultQuantity")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("pricedPerPerson")}
                  onCheckedChange={(value) => form.setValue("pricedPerPerson", value)}
                />
                <Label>{dialogMessages.fields.pricedPerPerson}</Label>
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
              {commonMessages.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? commonMessages.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
