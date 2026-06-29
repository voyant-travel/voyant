"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyant-travel/ui/components"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "../../form-resolver.js"
import type { AvailabilityCloseoutRow, AvailabilitySlotRow, ProductOption } from "../../index.js"
import { NONE_VALUE, nullableString, slotLocalStart } from "../../index.js"
import {
  type AvailabilityCloseoutSubmitPayload,
  type AvailabilityDialogMessages,
  DialogActions,
  formatSlotLocalDateTime,
  ProductSelect,
  type SubmitContext,
} from "./shared.js"

function getCloseoutFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.closeout.validationProductRequired),
    slotId: z.string().optional(),
    dateLocal: z.string().min(1, messages.dialogs.closeout.validationDateRequired),
    reason: z.string().optional(),
  })
}

type CloseoutFormSchema = ReturnType<typeof getCloseoutFormSchema>
type CloseoutFormValues = z.input<CloseoutFormSchema>
type CloseoutFormOutput = z.output<CloseoutFormSchema>

export function AvailabilityCloseoutDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  closeout?: AvailabilityCloseoutRow
  products: ProductOption[]
  slots: AvailabilitySlotRow[]
  onSubmit: (payload: AvailabilityCloseoutSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const closeoutMessages = props.messages.dialogs.closeout
  const closeoutFormSchema = getCloseoutFormSchema(props.messages)
  const form = useForm<CloseoutFormValues, unknown, CloseoutFormOutput>({
    resolver: zodResolver(closeoutFormSchema),
    defaultValues: {
      productId: "",
      slotId: NONE_VALUE,
      dateLocal: "",
      reason: "",
    },
  })

  useEffect(() => {
    if (props.open && props.closeout) {
      form.reset({
        productId: props.closeout.productId,
        slotId: props.closeout.slotId ?? NONE_VALUE,
        dateLocal: props.closeout.dateLocal,
        reason: props.closeout.reason ?? "",
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.closeout, props.open])

  const selectedProductId = form.watch("productId")
  const filteredSlots = props.slots.filter((slot) => slot.productId === selectedProductId)
  const isEditing = Boolean(props.closeout)

  const onSubmit = async (values: CloseoutFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        slotId: values.slotId === NONE_VALUE ? null : (values.slotId ?? null),
        dateLocal: values.dateLocal,
        reason: nullableString(values.reason),
      },
      { isEditing, id: props.closeout?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? closeoutMessages.editTitle : closeoutMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={closeoutMessages.productLabel}
              placeholder={closeoutMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid gap-2">
              <Label>{closeoutMessages.slotLabel}</Label>
              <Select
                value={form.watch("slotId") ?? NONE_VALUE}
                onValueChange={(value) => form.setValue("slotId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={closeoutMessages.optionalSlotPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{closeoutMessages.productLevelOption}</SelectItem>
                  {filteredSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {formatSlotLocalDateTime(slotLocalStart(slot))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.dateLabel}</Label>
              <DatePicker
                value={form.watch("dateLocal") || null}
                onChange={(nextValue) =>
                  form.setValue("dateLocal", nextValue ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={closeoutMessages.datePlaceholder}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.reasonLabel}</Label>
              <Textarea
                {...form.register("reason")}
                placeholder={closeoutMessages.reasonPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogActions
            cancel={closeoutMessages.cancel}
            save={closeoutMessages.save}
            create={closeoutMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
