"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voyant-travel/ui/components"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "../../form-resolver.js"
import type { AvailabilityStartTimeRow, ProductOption } from "../../index.js"
import { nullableNumber, nullableString } from "../../index.js"
import {
  type AvailabilityDialogMessages,
  type AvailabilityStartTimeSubmitPayload,
  DialogActions,
  ProductSelect,
  type SubmitContext,
  SwitchField,
} from "./shared.js"

function getStartTimeFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.startTime.validationProductRequired),
    label: z.string().optional(),
    startTimeLocal: z.string().min(1, messages.dialogs.startTime.validationStartTimeRequired),
    durationMinutes: z.string().optional(),
    sortOrder: z.coerce.number().int(),
    active: z.boolean(),
  })
}

type StartTimeFormSchema = ReturnType<typeof getStartTimeFormSchema>
type StartTimeFormValues = z.input<StartTimeFormSchema>
type StartTimeFormOutput = z.output<StartTimeFormSchema>

export function AvailabilityStartTimeDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime?: AvailabilityStartTimeRow
  products: ProductOption[]
  onSubmit: (payload: AvailabilityStartTimeSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const startTimeMessages = props.messages.dialogs.startTime
  const startTimeFormSchema = getStartTimeFormSchema(props.messages)
  const form = useForm<StartTimeFormValues, unknown, StartTimeFormOutput>({
    resolver: zodResolver(startTimeFormSchema),
    defaultValues: {
      productId: "",
      label: "",
      startTimeLocal: "09:00",
      durationMinutes: "",
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (props.open && props.startTime) {
      form.reset({
        productId: props.startTime.productId,
        label: props.startTime.label ?? "",
        startTimeLocal: props.startTime.startTimeLocal,
        durationMinutes: props.startTime.durationMinutes?.toString() ?? "",
        sortOrder: props.startTime.sortOrder,
        active: props.startTime.active,
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.startTime])

  const isEditing = Boolean(props.startTime)

  const onSubmit = async (values: StartTimeFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        label: nullableString(values.label),
        startTimeLocal: values.startTimeLocal,
        durationMinutes: nullableNumber(values.durationMinutes),
        sortOrder: values.sortOrder,
        active: values.active,
      },
      { isEditing, id: props.startTime?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? startTimeMessages.editTitle : startTimeMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={startTimeMessages.productLabel}
              placeholder={startTimeMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{startTimeMessages.labelLabel}</Label>
                <Input
                  {...form.register("label")}
                  placeholder={startTimeMessages.labelPlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.startTimeLabel}</Label>
                <Input {...form.register("startTimeLocal")} type="time" />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.durationMinutesLabel}</Label>
                <Input {...form.register("durationMinutes")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.sortOrderLabel}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>
            <SwitchField
              title={startTimeMessages.activeTitle}
              description={startTimeMessages.activeDescription}
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </DialogBody>
          <DialogActions
            cancel={startTimeMessages.cancel}
            save={startTimeMessages.save}
            create={startTimeMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
