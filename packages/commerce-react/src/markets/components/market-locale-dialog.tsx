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
  Switch,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useMarketsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type CreateMarketLocaleInput,
  type MarketLocaleRecord,
  type UpdateMarketLocaleInput,
  useMarketLocaleMutation,
} from "../index.js"

function createFormSchema(messages: ReturnType<typeof useMarketsUiMessagesOrDefault>) {
  return z.object({
    languageTag: z
      .string()
      .min(2, messages.marketLocaleDialog.validation.languageTagRequired)
      .max(35),
    isDefault: z.boolean(),
    sortOrder: z.coerce.number().int().min(0),
    active: z.boolean(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface MarketLocaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  marketId: string
  locale?: MarketLocaleRecord
  onSuccess?: (locale: MarketLocaleRecord) => void
}

export function MarketLocaleDialog({
  open,
  onOpenChange,
  marketId,
  locale,
  onSuccess,
}: MarketLocaleDialogProps) {
  const isEditing = Boolean(locale)
  const { create, update } = useMarketLocaleMutation()
  const messages = useMarketsUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      languageTag: "en",
      isDefault: false,
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (open && locale) {
      form.reset({
        languageTag: locale.languageTag,
        isDefault: locale.isDefault,
        sortOrder: locale.sortOrder,
        active: locale.active,
      })
      return
    }
    if (open) {
      form.reset({
        languageTag: "en",
        isDefault: false,
        sortOrder: 0,
        active: true,
      })
    }
  }, [form, locale, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateMarketLocaleInput | UpdateMarketLocaleInput = {
      languageTag: values.languageTag,
      isDefault: values.isDefault,
      sortOrder: values.sortOrder,
      active: values.active,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: locale!.id, input: payload })
      : await create.mutateAsync({ marketId, input: payload as CreateMarketLocaleInput })

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.marketLocaleDialog.titles.edit
              : messages.marketLocaleDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.marketLocaleDialog.fields.languageTag}</Label>
                <Input
                  {...form.register("languageTag")}
                  placeholder={messages.marketLocaleDialog.placeholders.languageTag}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketLocaleDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(value) => form.setValue("isDefault", value)}
                />
                <Label>{messages.marketLocaleDialog.fields.isDefault}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>{messages.marketLocaleDialog.fields.active}</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : messages.marketLocaleDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
