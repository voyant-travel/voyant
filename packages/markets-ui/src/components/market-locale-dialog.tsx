"use client"

import {
  type CreateMarketLocaleInput,
  type MarketLocaleRecord,
  type UpdateMarketLocaleInput,
  useMarketLocaleMutation,
} from "@voyantjs/markets-react"
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
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const formSchema = z.object({
  languageTag: z.string().min(2, "Language tag is required").max(35),
  isDefault: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  active: z.boolean(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

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
          <DialogTitle>{isEditing ? "Edit Locale" : "Add Locale"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Language tag</Label>
                <Input {...form.register("languageTag")} placeholder="en-GB, de-DE..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(value) => form.setValue("isDefault", value)}
                />
                <Label>Default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>Active</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Locale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
