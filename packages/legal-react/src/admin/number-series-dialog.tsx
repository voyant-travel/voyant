import { useOperatorAdminMessages } from "@voyant-travel/admin"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Button,
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
} from "@voyant-travel/ui/components"
import { Switch } from "@voyant-travel/ui/components/switch"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  type LegalContractNumberSeriesRecord,
  useLegalContractNumberSeries,
  useLegalContractNumberSeriesMutation,
} from "../index.js"

const seriesFormSchema = z.object({
  name: z.string().min(1, "nameRequired").max(255),
  prefix: z.string().min(1, "prefixRequired").max(20),
  separator: z.string().max(5).optional(),
  padLength: z.coerce.number().int().min(0).max(12).optional(),
  resetStrategy: z.enum(["never", "annual", "monthly"]),
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  active: z.boolean(),
  isDefault: z.boolean(),
})

type FormValues = z.input<typeof seriesFormSchema>
type FormOutput = z.output<typeof seriesFormSchema>

type NumberSeriesData = LegalContractNumberSeriesRecord

type NumberSeriesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: NumberSeriesData
  onSuccess: () => void
}

const RESET_STRATEGY_VALUES = ["never", "annual", "monthly"] as const
type ResetStrategyKey = (typeof RESET_STRATEGY_VALUES)[number]

const SCOPE_VALUES = ["customer", "supplier", "partner", "channel", "other"] as const
type ScopeKey = (typeof SCOPE_VALUES)[number]

const MIN_PAD_LENGTH = 0
const MAX_PAD_LENGTH = 12
const DEFAULT_PAD_LENGTH = 4

function previewPadLength(value: unknown) {
  const clampPadLength = (padLength: number) =>
    Math.min(MAX_PAD_LENGTH, Math.max(MIN_PAD_LENGTH, Math.trunc(padLength)))

  if (typeof value === "number") {
    return Number.isFinite(value) ? clampPadLength(value) : DEFAULT_PAD_LENGTH
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? clampPadLength(parsed) : DEFAULT_PAD_LENGTH
  }
  return DEFAULT_PAD_LENGTH
}

export function NumberSeriesDialog({
  open,
  onOpenChange,
  series,
  onSuccess,
}: NumberSeriesDialogProps) {
  const isEditing = !!series
  const t = useOperatorAdminMessages().legal.numberSeriesDialog
  const { create, update } = useLegalContractNumberSeriesMutation()
  const { data: existingList } = useLegalContractNumberSeries()

  const validationByCode: Record<string, string> = {
    nameRequired: t.validation.nameRequired,
    prefixRequired: t.validation.prefixRequired,
  }
  const resolveValidation = (code: string | undefined) =>
    (code && validationByCode[code]) || code || ""

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: {
      name: "",
      prefix: "CTR",
      separator: "",
      padLength: 4,
      resetStrategy: "never",
      scope: "customer",
      active: true,
      isDefault: false,
    },
  })

  useEffect(() => {
    if (open && series) {
      form.reset({
        name: series.name,
        prefix: series.prefix,
        separator: series.separator,
        padLength: series.padLength,
        resetStrategy: series.resetStrategy as FormValues["resetStrategy"],
        scope: series.scope as FormValues["scope"],
        active: series.active,
        isDefault: series.isDefault,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, series, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      prefix: values.prefix,
      separator: values.separator || "",
      padLength: values.padLength ?? DEFAULT_PAD_LENGTH,
      resetStrategy: values.resetStrategy,
      scope: values.scope,
      active: values.active,
      isDefault: values.isDefault,
    }

    if (isEditing && series) {
      await update.mutateAsync({ id: series.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const prefix = form.watch("prefix") || ""
  const separator = form.watch("separator") || ""
  const watchedScope = form.watch("scope")
  const watchedActive = form.watch("active")
  const padLengthValue = form.watch("padLength")

  // The DB has a partial unique index on (prefix, scope) WHERE active.
  // Surface the collision before submit so the operator gets a friendly
  // hint instead of an opaque server error.
  const conflictingSeries = useMemo(() => {
    if (!watchedActive || !prefix) return null
    const rows = existingList?.data ?? []
    return (
      rows.find(
        (row) =>
          row.active &&
          row.prefix === prefix &&
          row.scope === watchedScope &&
          row.id !== series?.id,
      ) ?? null
    )
  }, [existingList, watchedActive, prefix, watchedScope, series?.id])
  const padLength = previewPadLength(padLengthValue)
  const sampleSequence = series ? (series.currentSequence ?? 0) + 1 : 42
  const sampleNumber = `${prefix}${prefix && separator ? separator : ""}${String(
    sampleSequence,
  ).padStart(padLength, "0")}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? t.titleEdit : t.titleNew}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.nameLabel}</Label>
                <Input {...form.register("name")} placeholder={t.namePlaceholder} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {resolveValidation(form.formState.errors.name.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.prefixLabel}</Label>
                <Input
                  {...form.register("prefix")}
                  placeholder={t.prefixPlaceholder}
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">{t.prefixHelp}</p>
                {form.formState.errors.prefix && (
                  <p className="text-xs text-destructive">
                    {resolveValidation(form.formState.errors.prefix.message)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.separatorLabel}</Label>
                <Input
                  {...form.register("separator")}
                  placeholder={t.separatorPlaceholder}
                  maxLength={5}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.padLengthLabel}</Label>
                <Input {...form.register("padLength")} type="number" min={0} max={12} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">{t.previewLabel}</div>
              <div className="mt-1 font-mono text-sm">
                {sampleNumber || String(sampleSequence).padStart(padLength, "0")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {series ? t.previewExisting : t.previewSample}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.resetStrategyLabel}</Label>
                <Select
                  items={RESET_STRATEGY_VALUES.map((value) => ({
                    value,
                    label: t.resetStrategyOptions[value],
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
                    {RESET_STRATEGY_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t.resetStrategyOptions[value as ResetStrategyKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.scopeLabel}</Label>
                <Select
                  items={SCOPE_VALUES.map((value) => ({
                    value,
                    label: t.scopeOptions[value],
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t.scopeOptions[value as ScopeKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{t.activeLabel}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  disabled={!form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <div>
                  <Label>{t.defaultLabel}</Label>
                  <p className="text-xs text-muted-foreground">{t.defaultHelp}</p>
                </div>
              </div>
            </div>

            {conflictingSeries ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {formatMessage(t.conflictMessage, {
                  prefix: conflictingSeries.prefix,
                  scope: conflictingSeries.scope,
                  name: conflictingSeries.name,
                })}
              </p>
            ) : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || conflictingSeries !== null}
            >
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t.saveChanges : t.createAction}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
