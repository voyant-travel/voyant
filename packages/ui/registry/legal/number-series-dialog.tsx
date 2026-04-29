import {
  type LegalContractNumberSeriesRecord,
  useLegalContractNumberSeriesMutation,
} from "@voyantjs/legal-react"
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
} from "@/components/ui"
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  code: string
  name: string
  prefix?: string
  separator?: string
  padLength?: number
  resetStrategy: "never" | "annual" | "monthly"
  scope: "customer" | "supplier" | "partner" | "channel" | "other"
  active: boolean
}

export type NumberSeriesData = LegalContractNumberSeriesRecord

type NumberSeriesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: NumberSeriesData
  onSuccess: () => void
}

function createSeriesFormSchema(messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>) {
  return z.object({
    code: z.string().min(1, messages.numberSeriesDialog.validation.codeRequired).max(50),
    name: z.string().min(1, messages.numberSeriesDialog.validation.nameRequired).max(255),
    prefix: z.string().max(20).optional(),
    separator: z.string().max(5).optional(),
    padLength: z.coerce.number().int().min(0).max(12).optional(),
    resetStrategy: z.enum(["never", "annual", "monthly"]),
    scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
    active: z.boolean(),
  })
}

const RESET_STRATEGIES = ["never", "annual", "monthly"] as const
const SCOPES = ["customer", "supplier", "partner", "channel", "other"] as const

export function NumberSeriesDialog({
  open,
  onOpenChange,
  series,
  onSuccess,
}: NumberSeriesDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const seriesFormSchema = createSeriesFormSchema(messages)
  const isEditing = !!series
  const { create, update } = useLegalContractNumberSeriesMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: {
      code: "",
      name: "",
      prefix: "",
      separator: "",
      padLength: 4,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    },
  })

  useEffect(() => {
    if (open && series) {
      form.reset({
        code: series.code,
        name: series.name,
        prefix: series.prefix,
        separator: series.separator,
        padLength: series.padLength,
        resetStrategy: series.resetStrategy as FormValues["resetStrategy"],
        scope: series.scope as FormValues["scope"],
        active: series.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, series, form])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      code: values.code,
      name: values.name,
      prefix: values.prefix || "",
      separator: values.separator || "",
      padLength: values.padLength ?? 4,
      resetStrategy: values.resetStrategy,
      scope: values.scope,
      active: values.active,
    }

    if (isEditing && series) {
      await update.mutateAsync({ id: series.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.numberSeriesDialog.titles.edit
              : messages.numberSeriesDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.numberSeriesDialog.placeholders.code}
                  maxLength={50}
                />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.numberSeriesDialog.placeholders.name}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.prefix}</Label>
                <Input
                  {...form.register("prefix")}
                  placeholder={messages.numberSeriesDialog.placeholders.prefix}
                  maxLength={20}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.separator}</Label>
                <Input
                  {...form.register("separator")}
                  placeholder={messages.numberSeriesDialog.placeholders.separator}
                  maxLength={5}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.padLength}</Label>
                <Input {...form.register("padLength")} type="number" min={0} max={12} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.resetStrategy}</Label>
                <Select
                  items={RESET_STRATEGIES.map((item) => ({
                    label: messages.common.resetStrategyLabels[item],
                    value: item,
                  }))}
                  value={form.watch("resetStrategy")}
                  onValueChange={(v) =>
                    form.setValue("resetStrategy", v as FormValues["resetStrategy"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESET_STRATEGIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {messages.common.resetStrategyLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.numberSeriesDialog.fields.scope}</Label>
                <Select
                  items={SCOPES.map((item) => ({
                    label: messages.common.contractScopeLabels[item],
                    value: item,
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {messages.common.contractScopeLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.numberSeriesDialog.fields.active}</Label>
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
              {isEditing ? messages.common.saveChanges : messages.numberSeriesDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
