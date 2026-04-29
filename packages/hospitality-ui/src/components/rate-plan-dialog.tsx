import { type RatePlanRecord, useRatePlanMutation } from "@voyantjs/hospitality-react"
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
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useHospitalityUiMessagesOrDefault } from "../i18n"
import type {
  ChargeFrequency as HospitalityChargeFrequency,
  GuaranteeMode as HospitalityGuaranteeMode,
} from "../i18n/messages"
import { CancellationPolicyCombobox } from "./cancellation-policy-combobox"
import { MealPlanCombobox } from "./meal-plan-combobox"
import { PriceCatalogCombobox } from "./price-catalog-combobox"

export type RatePlanData = RatePlanRecord

const CHARGE_FREQUENCIES = [
  "per_night",
  "per_stay",
  "per_person_per_night",
  "per_person_per_stay",
] as const
const GUARANTEE_MODES = ["none", "deposit", "on_request", "card_hold", "full_prepay"] as const

type ChargeFrequency = RatePlanRecord["chargeFrequency"]
type GuaranteeMode = RatePlanRecord["guaranteeMode"]

const DEFAULT_RATE_PLAN_CURRENCY = "EUR" /* i18n-literal-ok domain default currency */

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  return z.object({
    code: z.string().min(1, messages.ratePlanDialog.validation.codeRequired).max(50),
    name: z.string().min(1, messages.ratePlanDialog.validation.nameRequired).max(255),
    description: z.string().optional().nullable(),
    mealPlanId: z.string().optional().nullable(),
    priceCatalogId: z.string().optional().nullable(),
    cancellationPolicyId: z.string().optional().nullable(),
    currencyCode: z.string().length(3, messages.ratePlanDialog.validation.currencyLength),
    chargeFrequency: z.enum(CHARGE_FREQUENCIES),
    guaranteeMode: z.enum(GUARANTEE_MODES),
    commissionable: z.boolean(),
    refundable: z.boolean(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface RatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  ratePlan?: RatePlanRecord
  onSuccess?: (ratePlan: RatePlanRecord) => void
}

export function RatePlanDialog({
  open,
  onOpenChange,
  propertyId,
  ratePlan,
  onSuccess,
}: RatePlanDialogProps) {
  const isEditing = Boolean(ratePlan)
  const { create, update } = useRatePlanMutation()
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      mealPlanId: "",
      priceCatalogId: "",
      cancellationPolicyId: "",
      currencyCode: DEFAULT_RATE_PLAN_CURRENCY,
      chargeFrequency: "per_night",
      guaranteeMode: "none",
      commissionable: true,
      refundable: true,
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && ratePlan) {
      form.reset({
        code: ratePlan.code,
        name: ratePlan.name,
        description: ratePlan.description ?? "",
        mealPlanId: ratePlan.mealPlanId ?? "",
        priceCatalogId: ratePlan.priceCatalogId ?? "",
        cancellationPolicyId: ratePlan.cancellationPolicyId ?? "",
        currencyCode: ratePlan.currencyCode,
        chargeFrequency: ratePlan.chargeFrequency,
        guaranteeMode: ratePlan.guaranteeMode,
        commissionable: ratePlan.commissionable,
        refundable: ratePlan.refundable,
        active: ratePlan.active,
        sortOrder: ratePlan.sortOrder,
      })
    } else if (open) {
      form.reset({
        code: "",
        name: "",
        description: "",
        mealPlanId: "",
        priceCatalogId: "",
        cancellationPolicyId: "",
        currencyCode: DEFAULT_RATE_PLAN_CURRENCY,
        chargeFrequency: "per_night",
        guaranteeMode: "none",
        commissionable: true,
        refundable: true,
        active: true,
        sortOrder: 0,
      })
    }
  }, [form, open, ratePlan])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      code: values.code,
      name: values.name,
      description: values.description || null,
      mealPlanId: values.mealPlanId || null,
      priceCatalogId: values.priceCatalogId || null,
      cancellationPolicyId: values.cancellationPolicyId || null,
      currencyCode: values.currencyCode.toUpperCase(),
      chargeFrequency: values.chargeFrequency,
      guaranteeMode: values.guaranteeMode,
      commissionable: values.commissionable,
      refundable: values.refundable,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: ratePlan!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.ratePlanDialog.titles.edit
              : messages.ratePlanDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.ratePlanDialog.placeholders.code}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.ratePlanDialog.placeholders.name}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.ratePlanDialog.fields.description}</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={form.watch("currencyCode") || null}
                  onChange={(next) =>
                    form.setValue("currencyCode", next ?? DEFAULT_RATE_PLAN_CURRENCY, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.chargeFrequency}</Label>
                <Select
                  items={CHARGE_FREQUENCIES.map((frequency) => ({
                    label:
                      messages.common.chargeFrequencyLabels[
                        frequency as HospitalityChargeFrequency
                      ],
                    value: frequency,
                  }))}
                  value={form.watch("chargeFrequency")}
                  onValueChange={(value) =>
                    form.setValue("chargeFrequency", value as ChargeFrequency)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {
                          messages.common.chargeFrequencyLabels[
                            frequency as HospitalityChargeFrequency
                          ]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.guarantee}</Label>
                <Select
                  items={GUARANTEE_MODES.map((mode) => ({
                    label: messages.common.guaranteeModeLabels[mode as HospitalityGuaranteeMode],
                    value: mode,
                  }))}
                  value={form.watch("guaranteeMode")}
                  onValueChange={(value) => form.setValue("guaranteeMode", value as GuaranteeMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GUARANTEE_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {messages.common.guaranteeModeLabels[mode as HospitalityGuaranteeMode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.mealPlan}</Label>
                <MealPlanCombobox
                  propertyId={propertyId}
                  value={form.watch("mealPlanId")}
                  onChange={(value) => form.setValue("mealPlanId", value ?? "")}
                  placeholder={messages.ratePlanDialog.placeholders.mealPlan}
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.priceCatalog}</Label>
                <PriceCatalogCombobox
                  value={form.watch("priceCatalogId")}
                  onChange={(value) => form.setValue("priceCatalogId", value ?? "")}
                  placeholder={messages.ratePlanDialog.placeholders.priceCatalog}
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.ratePlanDialog.fields.cancellationPolicy}</Label>
                <CancellationPolicyCombobox
                  value={form.watch("cancellationPolicyId")}
                  onChange={(value) => form.setValue("cancellationPolicyId", value ?? "")}
                  placeholder={messages.ratePlanDialog.placeholders.cancellationPolicy}
                  disabled={!open}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("commissionable")}
                  onCheckedChange={(checked) => form.setValue("commissionable", checked)}
                />
                <Label>{messages.ratePlanDialog.fields.commissionable}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("refundable")}
                  onCheckedChange={(checked) => form.setValue("refundable", checked)}
                />
                <Label>{messages.ratePlanDialog.fields.refundable}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.ratePlanDialog.fields.active}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.ratePlanDialog.fields.sortOrder}</Label>
              <Input {...form.register("sortOrder")} type="number" className="w-32" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.ratePlanDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
