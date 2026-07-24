"use client"

import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { ChevronDown, Loader2 } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { invoiceNumberResetStrategies, invoiceNumberSeriesScopes } from "../i18n/messages.js"
import {
  type InvoiceNumberSeriesRecord,
  type InvoiceNumberSeriesScope,
  useInvoiceNumberSeriesMutation,
} from "../index.js"
import { formatInvoiceNumberSeriesSample } from "./invoice-number-series-format.js"

const seriesFormSchema = z.object({
  code: z.string().min(1, "codeRequired").max(100),
  name: z.string().min(1, "nameRequired").max(255),
  prefix: z.string().max(50).default(""),
  separator: z.string().max(10).default(""),
  padLength: z.coerce
    .number()
    .int("padLengthInvalid")
    .min(0, "padLengthInvalid")
    .max(20, "padLengthInvalid"),
  currentSequence: z.coerce.number().int("currentSequenceInvalid").min(0, "currentSequenceInvalid"),
  resetStrategy: z.enum(invoiceNumberResetStrategies),
  scope: z.enum(invoiceNumberSeriesScopes),
  isDefault: z.boolean(),
  externalProvider: z.string().max(100).optional(),
  externalConfigKey: z.string().max(100).optional(),
  active: z.boolean(),
})

type FormValues = z.input<typeof seriesFormSchema>
type FormOutput = z.output<typeof seriesFormSchema>

export interface InvoiceNumberSeriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: InvoiceNumberSeriesRecord
  onSuccess?: () => void
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function resolveValidation(
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
  code?: string,
) {
  const validation = messages.invoiceNumberSeriesDialog.validation
  if (!code) return ""
  if (code === "codeRequired") return validation.codeRequired
  if (code === "nameRequired") return validation.nameRequired
  if (code === "padLengthInvalid") return validation.padLengthInvalid
  if (code === "currentSequenceInvalid") return validation.currentSequenceInvalid
  return code
}

export function InvoiceNumberSeriesDialog({
  open,
  onOpenChange,
  series,
  onSuccess,
}: InvoiceNumberSeriesDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const dialog = messages.invoiceNumberSeriesDialog
  const page = messages.invoiceNumberSeriesPage
  const isEditing = !!series
  const { create, update } = useInvoiceNumberSeriesMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: {
      code: "",
      name: "",
      prefix: "INV",
      separator: "-",
      padLength: 4,
      currentSequence: 0,
      resetStrategy: "never",
      scope: "invoice",
      isDefault: false,
      externalProvider: "",
      externalConfigKey: "",
      active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    if (series) {
      form.reset({
        code: series.code,
        name: series.name,
        prefix: series.prefix,
        separator: series.separator,
        padLength: series.padLength,
        currentSequence: series.currentSequence,
        resetStrategy: series.resetStrategy,
        scope: series.scope,
        isDefault: series.isDefault,
        externalProvider: series.externalProvider ?? "",
        externalConfigKey: series.externalConfigKey ?? "",
        active: series.active,
      })
      return
    }
    form.reset()
  }, [form, open, series])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      prefix: values.prefix,
      separator: values.separator,
      padLength: values.padLength,
      currentSequence: values.currentSequence,
      resetStrategy: values.resetStrategy,
      scope: values.scope,
      isDefault: values.isDefault,
      externalProvider: emptyToNull(values.externalProvider),
      externalConfigKey: emptyToNull(values.externalConfigKey),
      active: values.active,
    }

    if (series) {
      await update.mutateAsync({ id: series.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess?.()
  }

  const prefix = form.watch("prefix") ?? ""
  const separator = form.watch("separator") ?? ""
  const currentSequence = Number(form.watch("currentSequence") ?? 0)
  const padLength = Number(form.watch("padLength") ?? 4)
  const preview = formatInvoiceNumberSeriesSample({
    prefix,
    separator,
    currentSequence: Number.isFinite(currentSequence) ? currentSequence : 0,
    padLength: Number.isFinite(padLength) ? padLength : 4,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldError label={dialog.fields.code} error={form.formState.errors.code?.message}>
                <Input {...form.register("code")} placeholder={dialog.placeholders.code} />
              </FieldError>
              <FieldError label={dialog.fields.name} error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} placeholder={dialog.placeholders.name} />
              </FieldError>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <FieldError
                label={dialog.fields.prefix}
                error={form.formState.errors.prefix?.message}
              >
                <Input {...form.register("prefix")} placeholder={dialog.placeholders.prefix} />
              </FieldError>
              <FieldError
                label={dialog.fields.separator}
                error={form.formState.errors.separator?.message}
              >
                <Input
                  {...form.register("separator")}
                  placeholder={dialog.placeholders.separator}
                />
              </FieldError>
              <FieldError
                label={dialog.fields.padLength}
                error={form.formState.errors.padLength?.message}
              >
                <Input {...form.register("padLength")} type="number" min={0} max={20} />
              </FieldError>
              <FieldError
                label={dialog.fields.currentSequence}
                error={form.formState.errors.currentSequence?.message}
              >
                <Input {...form.register("currentSequence")} type="number" min={0} />
              </FieldError>
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">{dialog.help.previewLabel}</div>
              <div className="mt-1 font-mono text-sm">{preview}</div>
              <p className="mt-1 text-xs text-muted-foreground">{dialog.help.previewSample}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.resetStrategy}</Label>
                <Select
                  value={form.watch("resetStrategy")}
                  onValueChange={(value) =>
                    form.setValue("resetStrategy", value as FormValues["resetStrategy"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceNumberResetStrategies.map((value) => (
                      <SelectItem key={value} value={value}>
                        {page.resetStrategyLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.scope}</Label>
                <Select
                  value={form.watch("scope")}
                  onValueChange={(value) =>
                    form.setValue("scope", value as InvoiceNumberSeriesScope)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceNumberSeriesScopes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {page.scopeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Collapsible className="flex flex-col gap-3">
              <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown
                  className="size-4 transition-transform group-data-[panel-open]:rotate-180"
                  aria-hidden="true"
                />
                {dialog.advancedLabel}
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{dialog.fields.externalProvider}</Label>
                  <Input
                    {...form.register("externalProvider")}
                    placeholder={dialog.placeholders.externalProvider}
                  />
                  <p className="text-xs text-muted-foreground">{dialog.help.external}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dialog.fields.externalConfigKey}</Label>
                  <Input
                    {...form.register("externalConfigKey")}
                    placeholder={dialog.placeholders.externalConfigKey}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
              <SwitchField
                label={dialog.fields.isDefault}
                help={dialog.help.default}
                checked={form.watch("isDefault")}
                onCheckedChange={(checked) => form.setValue("isDefault", checked)}
              />
              <SwitchField
                label={dialog.fields.active}
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? messages.common.saveChanges : dialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )

  function FieldError({
    children,
    error,
    label,
  }: {
    children: ReactNode
    error?: string
    label: string
  }) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{label}</Label>
        {children}
        {error ? (
          <p className="text-xs text-destructive">{resolveValidation(messages, error)}</p>
        ) : null}
      </div>
    )
  }
}

function SwitchField({
  checked,
  help,
  label,
  onCheckedChange,
}: {
  checked: boolean
  help?: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <div className="space-y-1">
        <Label>{label}</Label>
        {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      </div>
    </div>
  )
}
