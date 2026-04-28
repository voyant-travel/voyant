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

const formSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().nullable(),
  mealPlanId: z.string().optional().nullable(),
  priceCatalogId: z.string().optional().nullable(),
  cancellationPolicyId: z.string().optional().nullable(),
  currencyCode: z.string().length(3, "Currency must be 3 chars"),
  chargeFrequency: z.enum(CHARGE_FREQUENCIES),
  guaranteeMode: z.enum(GUARANTEE_MODES),
  commissionable: z.boolean(),
  refundable: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

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

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      mealPlanId: "",
      priceCatalogId: "",
      cancellationPolicyId: "",
      currencyCode: "EUR",
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
        currencyCode: "EUR",
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
          <DialogTitle>{isEditing ? "Edit Rate Plan" : "Add Rate Plan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="FLEX" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Flexible Rate" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
                <CurrencyCombobox
                  value={form.watch("currencyCode") || null}
                  onChange={(next) =>
                    form.setValue("currencyCode", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Charge frequency</Label>
                <Select
                  items={CHARGE_FREQUENCIES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
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
                      <SelectItem key={frequency} value={frequency} className="capitalize">
                        {frequency.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Guarantee</Label>
                <Select
                  items={GUARANTEE_MODES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("guaranteeMode")}
                  onValueChange={(value) => form.setValue("guaranteeMode", value as GuaranteeMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GUARANTEE_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode} className="capitalize">
                        {mode.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Meal plan</Label>
                <MealPlanCombobox
                  propertyId={propertyId}
                  value={form.watch("mealPlanId")}
                  onChange={(value) => form.setValue("mealPlanId", value ?? "")}
                  placeholder="None"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Price catalog</Label>
                <PriceCatalogCombobox
                  value={form.watch("priceCatalogId")}
                  onChange={(value) => form.setValue("priceCatalogId", value ?? "")}
                  placeholder="None"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cancellation policy</Label>
                <CancellationPolicyCombobox
                  value={form.watch("cancellationPolicyId")}
                  onChange={(value) => form.setValue("cancellationPolicyId", value ?? "")}
                  placeholder="None"
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
                <Label>Commissionable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("refundable")}
                  onCheckedChange={(checked) => form.setValue("refundable", checked)}
                />
                <Label>Refundable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Sort order</Label>
              <Input {...form.register("sortOrder")} type="number" className="w-32" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Rate Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
