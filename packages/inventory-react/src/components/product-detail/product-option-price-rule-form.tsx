import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  CancellationPolicyCombobox,
  PriceCatalogCombobox,
  PriceScheduleCombobox,
  useOptionPriceRuleMutation,
} from "./commerce-client.js"
import { useProductDetailMessages } from "./host.js"
import { zodResolver } from "./zod-resolver.js"

type PriceRuleMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["priceRules"]

const buildRuleFormSchema = (messages: PriceRuleMessages) =>
  z.object({
    priceCatalogId: z.string().min(1, messages.validationCatalogRequired),
    priceScheduleId: z.string().optional().nullable(),
    cancellationPolicyId: z.string().optional().nullable(),
    name: z.string().min(1, messages.validationNameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    pricingMode: z.enum(["per_person", "per_booking", "starting_from", "free", "on_request"]),
    baseSell: z.coerce.number().min(0),
    baseCost: z.coerce.number().min(0),
    minPerBooking: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxPerBooking: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    allPricingCategories: z.boolean(),
    isDefault: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })

type RuleFormSchema = ReturnType<typeof buildRuleFormSchema>
type RuleFormValues = z.input<RuleFormSchema>
type RuleFormOutput = z.output<RuleFormSchema>

export type OptionPriceRuleData = {
  id: string
  productId: string
  optionId: string
  priceCatalogId: string
  priceScheduleId: string | null
  cancellationPolicyId: string | null
  name: string
  code: string | null
  description: string | null
  pricingMode: "per_person" | "per_booking" | "starting_from" | "free" | "on_request"
  baseSellAmountCents: number | null
  baseCostAmountCents: number | null
  minPerBooking: number | null
  maxPerBooking: number | null
  allPricingCategories: boolean
  isDefault: boolean
  active: boolean
  notes: string | null
}

export interface OptionPriceRuleFormProps {
  productId: string
  optionId: string
  rule?: OptionPriceRuleData
  onSuccess: () => void
  onCancel?: () => void
}

function initialValues(rule: OptionPriceRuleData | undefined): RuleFormValues {
  if (rule) {
    return {
      priceCatalogId: rule.priceCatalogId,
      priceScheduleId: rule.priceScheduleId ?? "",
      cancellationPolicyId: rule.cancellationPolicyId ?? "",
      name: rule.name,
      code: rule.code ?? "",
      description: rule.description ?? "",
      pricingMode: rule.pricingMode,
      baseSell: (rule.baseSellAmountCents ?? 0) / 100,
      baseCost: (rule.baseCostAmountCents ?? 0) / 100,
      minPerBooking: rule.minPerBooking ?? "",
      maxPerBooking: rule.maxPerBooking ?? "",
      allPricingCategories: rule.allPricingCategories,
      isDefault: rule.isDefault,
      active: rule.active,
      notes: rule.notes ?? "",
    }
  }
  return {
    priceCatalogId: "",
    priceScheduleId: "",
    cancellationPolicyId: "",
    name: "",
    code: "",
    description: "",
    pricingMode: "per_person",
    baseSell: 0,
    baseCost: 0,
    minPerBooking: "",
    maxPerBooking: "",
    allPricingCategories: true,
    isDefault: false,
    active: true,
    notes: "",
  }
}

export function OptionPriceRuleForm({
  productId,
  optionId,
  rule,
  onSuccess,
  onCancel,
}: OptionPriceRuleFormProps) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const priceRuleMessages = messages.products.operations.priceRules
  const isEditing = !!rule
  const { create, update } = useOptionPriceRuleMutation()
  const ruleFormSchema = buildRuleFormSchema(priceRuleMessages)
  const pricingModes = [
    { value: "per_person", label: priceRuleMessages.pricingModePerPerson },
    { value: "per_booking", label: priceRuleMessages.pricingModePerBooking },
    { value: "starting_from", label: priceRuleMessages.pricingModeStartingFrom },
    { value: "free", label: priceRuleMessages.pricingModeFree },
    { value: "on_request", label: priceRuleMessages.pricingModeOnRequest },
  ] as const

  const form = useForm<RuleFormValues, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: initialValues(rule),
  })
  const watchedCatalogId = form.watch("priceCatalogId")

  useEffect(() => {
    form.reset(initialValues(rule))
  }, [rule, form])

  const onSubmit = async (values: RuleFormOutput) => {
    const payload = {
      productId,
      optionId,
      priceCatalogId: values.priceCatalogId,
      priceScheduleId: values.priceScheduleId || null,
      cancellationPolicyId: values.cancellationPolicyId || null,
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      pricingMode: values.pricingMode,
      baseSellAmountCents: Math.round(values.baseSell * 100),
      baseCostAmountCents: Math.round(values.baseCost * 100),
      minPerBooking: typeof values.minPerBooking === "number" ? values.minPerBooking : null,
      maxPerBooking: typeof values.maxPerBooking === "number" ? values.maxPerBooking : null,
      allPricingCategories: values.allPricingCategories,
      isDefault: values.isDefault,
      active: values.active,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: rule.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.catalogLabel}</Label>
            <PriceCatalogCombobox
              value={form.watch("priceCatalogId")}
              onChange={(value) => {
                form.setValue("priceCatalogId", value ?? "", {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                form.setValue("priceScheduleId", "", { shouldDirty: true })
              }}
            />
            {form.formState.errors.priceCatalogId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.priceCatalogId.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.nameLabel}</Label>
            <Input {...form.register("name")} placeholder={priceRuleMessages.namePlaceholder} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.scheduleLabel}</Label>
            <PriceScheduleCombobox
              priceCatalogId={watchedCatalogId}
              value={form.watch("priceScheduleId")}
              onChange={(value) =>
                form.setValue("priceScheduleId", value ?? "", { shouldDirty: true })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.cancellationPolicyLabel}</Label>
            <CancellationPolicyCombobox
              value={form.watch("cancellationPolicyId")}
              onChange={(value) =>
                form.setValue("cancellationPolicyId", value ?? "", { shouldDirty: true })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.pricingModeLabel}</Label>
            <Select
              value={form.watch("pricingMode")}
              onValueChange={(v) =>
                form.setValue("pricingMode", v as RuleFormValues["pricingMode"])
              }
              items={pricingModes}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pricingModes.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.baseSellInputLabel}</Label>
            <Input {...form.register("baseSell")} type="number" step="0.01" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.baseCostInputLabel}</Label>
            <Input {...form.register("baseCost")} type="number" step="0.01" min="0" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.codeLabel}</Label>
            <Input {...form.register("code")} placeholder={priceRuleMessages.codePlaceholder} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.descriptionLabel}</Label>
            <Input {...form.register("description")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.minPerBookingLabel}</Label>
            <Input {...form.register("minPerBooking")} type="number" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{priceRuleMessages.maxPerBookingLabel}</Label>
            <Input {...form.register("maxPerBooking")} type="number" min="0" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("allPricingCategories")}
              onCheckedChange={(v) => form.setValue("allPricingCategories", v)}
            />
            <Label>{priceRuleMessages.allCategoriesSwitchLabel}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("isDefault")}
              onCheckedChange={(v) => form.setValue("isDefault", v)}
            />
            <Label>{priceRuleMessages.defaultSwitchLabel}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("active")}
              onCheckedChange={(v) => form.setValue("active", v)}
            />
            <Label>{priceRuleMessages.activeSwitchLabel}</Label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{priceRuleMessages.notesLabel}</Label>
          <Textarea {...form.register("notes")} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? productMessages.saveChanges : priceRuleMessages.create}
        </Button>
      </div>
    </form>
  )
}
