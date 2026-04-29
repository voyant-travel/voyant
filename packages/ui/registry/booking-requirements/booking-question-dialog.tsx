"use client"

import {
  type BookingQuestion,
  QUESTION_FIELD_TYPES,
  QUESTION_TARGETS,
} from "@voyantjs/booking-requirements-react"
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
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import { useBookingRequirementsUiMessagesOrDefault } from "../../../../booking-requirements-ui/src/index"

import { useRegistryBookingRequirementsMessagesOrDefault } from "./i18n"

function createFormSchema(
  messages: ReturnType<typeof useRegistryBookingRequirementsMessagesOrDefault>,
) {
  return z.object({
    label: z.string().min(1, messages.bookingQuestionDialog.validation.labelRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    target: z.enum(["booking", "traveler", "lead_traveler", "booker", "extra", "service"]),
    fieldType: z.enum([
      "text",
      "textarea",
      "number",
      "email",
      "phone",
      "date",
      "datetime",
      "boolean",
      "single_select",
      "multi_select",
      "file",
      "country",
      "other",
    ]),
    placeholder: z.string().optional().nullable(),
    helpText: z.string().optional().nullable(),
    isRequired: z.boolean(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
}

export interface BookingQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  question?: BookingQuestion
  nextSortOrder?: number
  onSuccess: () => void
}

export function BookingQuestionDialog({
  open,
  onOpenChange,
  productId,
  question,
  nextSortOrder,
  onSuccess,
}: BookingQuestionDialogProps) {
  const sharedMessages = useBookingRequirementsUiMessagesOrDefault()
  const messages = useRegistryBookingRequirementsMessagesOrDefault()
  const dialogMessages = messages.bookingQuestionDialog
  const formSchema = createFormSchema(messages)
  const isEditing = !!question

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>
  type Target = FormOutput["target"]
  type FieldType = FormOutput["fieldType"]

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      code: "",
      description: "",
      target: "booking",
      fieldType: "text",
      placeholder: "",
      helpText: "",
      isRequired: false,
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && question) {
      form.reset({
        label: question.label,
        code: question.code ?? "",
        description: question.description ?? "",
        target: question.target,
        fieldType: question.fieldType,
        placeholder: question.placeholder ?? "",
        helpText: question.helpText ?? "",
        isRequired: question.isRequired,
        active: question.active,
        sortOrder: question.sortOrder,
      })
    } else if (open) {
      form.reset({
        label: "",
        code: "",
        description: "",
        target: "booking",
        fieldType: "text",
        placeholder: "",
        helpText: "",
        isRequired: false,
        active: true,
        sortOrder: nextSortOrder ?? 0,
      })
    }
  }, [form, nextSortOrder, open, question])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productId,
      label: values.label,
      code: values.code || null,
      description: values.description || null,
      target: values.target,
      fieldType: values.fieldType,
      placeholder: values.placeholder || null,
      helpText: values.helpText || null,
      isRequired: values.isRequired,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    if (isEditing) {
      await api.patch(`/v1/booking-requirements/questions/${question.id}`, payload)
    } else {
      await api.post("/v1/booking-requirements/questions", payload)
    }

    onSuccess()
  }

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
                <Label>{dialogMessages.fields.label}</Label>
                <Input
                  {...form.register("label")}
                  placeholder={dialogMessages.placeholders.label}
                />
                {form.formState.errors.label ? (
                  <p className="text-xs text-destructive">{form.formState.errors.label.message}</p>
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
                <Label>{dialogMessages.fields.target}</Label>
                <Select
                  items={QUESTION_TARGETS.map((target) => ({
                    label: sharedMessages.common.questionTargetLabels[target.value as Target],
                    value: target.value,
                  }))}
                  value={form.watch("target")}
                  onValueChange={(value) => form.setValue("target", value as Target)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TARGETS.map((target) => (
                      <SelectItem key={target.value} value={target.value}>
                        {sharedMessages.common.questionTargetLabels[target.value as Target]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.fieldType}</Label>
                <Select
                  items={QUESTION_FIELD_TYPES.map((fieldType) => ({
                    label:
                      sharedMessages.common.questionFieldTypeLabels[fieldType.value as FieldType],
                    value: fieldType.value,
                  }))}
                  value={form.watch("fieldType")}
                  onValueChange={(value) => form.setValue("fieldType", value as FieldType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_FIELD_TYPES.map((fieldType) => (
                      <SelectItem key={fieldType.value} value={fieldType.value}>
                        {
                          sharedMessages.common.questionFieldTypeLabels[
                            fieldType.value as FieldType
                          ]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.placeholder}</Label>
                <Input
                  {...form.register("placeholder")}
                  placeholder={dialogMessages.placeholders.placeholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.helpText}</Label>
                <Input
                  {...form.register("helpText")}
                  placeholder={dialogMessages.placeholders.helpText}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isRequired")}
                  onCheckedChange={(value) => form.setValue("isRequired", value)}
                />
                <Label>{dialogMessages.fields.required}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>{dialogMessages.fields.active}</Label>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
