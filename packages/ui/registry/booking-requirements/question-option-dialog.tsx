"use client"

import type { BookingQuestionOption } from "@voyantjs/booking-requirements-react"
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
} from "@/components/ui"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryBookingRequirementsMessagesOrDefault } from "./i18n"

function createFormSchema(
  messages: ReturnType<typeof useRegistryBookingRequirementsMessagesOrDefault>,
) {
  return z.object({
    value: z.string().min(1, messages.questionOptionDialog.validation.valueRequired).max(255),
    label: z.string().min(1, messages.questionOptionDialog.validation.labelRequired).max(255),
    sortOrder: z.coerce.number().int(),
    isDefault: z.boolean(),
    active: z.boolean(),
  })
}

export interface QuestionOptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionId: string
  option?: BookingQuestionOption
  nextSortOrder?: number
  onSuccess: () => void
}

export function QuestionOptionDialog({
  open,
  onOpenChange,
  questionId,
  option,
  nextSortOrder,
  onSuccess,
}: QuestionOptionDialogProps) {
  const messages = useRegistryBookingRequirementsMessagesOrDefault()
  const dialogMessages = messages.questionOptionDialog
  const formSchema = createFormSchema(messages)
  const isEditing = !!option

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
      label: "",
      sortOrder: 0,
      isDefault: false,
      active: true,
    },
  })

  useEffect(() => {
    if (open && option) {
      form.reset({
        value: option.value,
        label: option.label,
        sortOrder: option.sortOrder,
        isDefault: option.isDefault,
        active: option.active,
      })
    } else if (open) {
      form.reset({
        value: "",
        label: "",
        sortOrder: nextSortOrder ?? 0,
        isDefault: false,
        active: true,
      })
    }
  }, [form, nextSortOrder, open, option])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productBookingQuestionId: questionId,
      value: values.value,
      label: values.label,
      sortOrder: values.sortOrder,
      isDefault: values.isDefault,
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/booking-requirements/question-options/${option.id}`, payload)
    } else {
      await api.post("/v1/booking-requirements/question-options", payload)
    }

    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titles.edit : dialogMessages.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.value}</Label>
                <Input
                  {...form.register("value")}
                  placeholder={dialogMessages.placeholders.value}
                />
                {form.formState.errors.value ? (
                  <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
                ) : null}
              </div>
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(value) => form.setValue("isDefault", value)}
                />
                <Label>{dialogMessages.fields.isDefault}</Label>
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
