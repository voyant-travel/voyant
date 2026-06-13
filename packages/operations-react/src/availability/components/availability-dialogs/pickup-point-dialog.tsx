"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "../../form-resolver.js"
import type { AvailabilityPickupPointRow, ProductOption } from "../../index.js"
import { nullableString } from "../../index.js"
import {
  type AvailabilityDialogMessages,
  type AvailabilityPickupPointSubmitPayload,
  DialogActions,
  ProductSelect,
  type SubmitContext,
  SwitchField,
} from "./shared.js"

function getPickupPointFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.pickupPoint.validationProductRequired),
    name: z.string().min(1, messages.dialogs.pickupPoint.validationNameRequired),
    description: z.string().optional(),
    locationText: z.string().optional(),
    active: z.boolean(),
  })
}

type PickupPointFormSchema = ReturnType<typeof getPickupPointFormSchema>
type PickupPointFormValues = z.input<PickupPointFormSchema>
type PickupPointFormOutput = z.output<PickupPointFormSchema>

export function AvailabilityPickupPointDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  pickupPoint?: AvailabilityPickupPointRow
  products: ProductOption[]
  onSubmit: (payload: AvailabilityPickupPointSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const pickupPointMessages = props.messages.dialogs.pickupPoint
  const pickupPointFormSchema = getPickupPointFormSchema(props.messages)
  const form = useForm<PickupPointFormValues, unknown, PickupPointFormOutput>({
    resolver: zodResolver(pickupPointFormSchema),
    defaultValues: {
      productId: "",
      name: "",
      description: "",
      locationText: "",
      active: true,
    },
  })

  useEffect(() => {
    if (props.open && props.pickupPoint) {
      form.reset({
        productId: props.pickupPoint.productId,
        name: props.pickupPoint.name,
        description: props.pickupPoint.description ?? "",
        locationText: props.pickupPoint.locationText ?? "",
        active: props.pickupPoint.active,
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.pickupPoint])

  const isEditing = Boolean(props.pickupPoint)

  const onSubmit = async (values: PickupPointFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        name: values.name,
        description: nullableString(values.description),
        locationText: nullableString(values.locationText),
        active: values.active,
      },
      { isEditing, id: props.pickupPoint?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? pickupPointMessages.editTitle : pickupPointMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={pickupPointMessages.productLabel}
              placeholder={pickupPointMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid gap-2">
              <Label>{pickupPointMessages.nameLabel}</Label>
              <Input {...form.register("name")} placeholder={pickupPointMessages.namePlaceholder} />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.locationTextLabel}</Label>
              <Input
                {...form.register("locationText")}
                placeholder={pickupPointMessages.locationTextPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={pickupPointMessages.descriptionPlaceholder}
              />
            </div>
            <SwitchField
              title={pickupPointMessages.activeTitle}
              description={pickupPointMessages.activeDescription}
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </DialogBody>
          <DialogActions
            cancel={pickupPointMessages.cancel}
            save={pickupPointMessages.save}
            create={pickupPointMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
