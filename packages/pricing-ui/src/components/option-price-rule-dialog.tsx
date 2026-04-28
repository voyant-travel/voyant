"use client"

import { type OptionPriceRuleRecord, useOptionPriceRuleMutation } from "@voyantjs/pricing-react"
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
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { CancellationPolicyCombobox } from "./cancellation-policy-combobox"
import { PriceCatalogCombobox } from "./price-catalog-combobox"
import { PriceScheduleCombobox } from "./price-schedule-combobox"
import { ProductCombobox } from "./product-combobox"
import { ProductOptionCombobox } from "./product-option-combobox"

const PRICING_MODES = ["per_person", "per_booking", "starting_from", "free", "on_request"] as const
type PricingMode = (typeof PRICING_MODES)[number]

const formSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  optionId: z.string().min(1, "Option is required"),
  priceCatalogId: z.string().min(1, "Catalog is required"),
  priceScheduleId: z.string().optional().nullable(),
  cancellationPolicyId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  pricingMode: z.enum(PRICING_MODES),
  baseSell: z.coerce.number().min(0),
  baseCost: z.coerce.number().min(0),
  minPerBooking: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  maxPerBooking: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  allPricingCategories: z.boolean(),
  isDefault: z.boolean(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface OptionPriceRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: OptionPriceRuleRecord
  onSuccess?: (rule: OptionPriceRuleRecord) => void
}

const toInt = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? value : null

export function OptionPriceRuleDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: OptionPriceRuleDialogProps) {
  const isEditing = !!rule
  const { create, update } = useOptionPriceRuleMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      optionId: "",
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
    },
  })

  const watchedProductId = form.watch("productId")
  const watchedCatalogId = form.watch("priceCatalogId")

  useEffect(() => {
    if (open && rule) {
      form.reset({
        productId: rule.productId,
        optionId: rule.optionId,
        priceCatalogId: rule.priceCatalogId,
        priceScheduleId: rule.priceScheduleId ?? "",
        cancellationPolicyId: rule.cancellationPolicyId ?? "",
        name: rule.name,
        code: rule.code ?? "",
        description: rule.description ?? "",
        pricingMode: rule.pricingMode,
        baseSell: rule.baseSellAmountCents != null ? rule.baseSellAmountCents / 100 : 0,
        baseCost: rule.baseCostAmountCents != null ? rule.baseCostAmountCents / 100 : 0,
        minPerBooking: rule.minPerBooking ?? "",
        maxPerBooking: rule.maxPerBooking ?? "",
        allPricingCategories: rule.allPricingCategories,
        isDefault: rule.isDefault,
        active: rule.active,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, rule, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productId: values.productId,
      optionId: values.optionId,
      priceCatalogId: values.priceCatalogId,
      priceScheduleId: values.priceScheduleId || null,
      cancellationPolicyId: values.cancellationPolicyId || null,
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      pricingMode: values.pricingMode,
      baseSellAmountCents: Math.round(values.baseSell * 100),
      baseCostAmountCents: Math.round(values.baseCost * 100),
      minPerBooking: toInt(values.minPerBooking),
      maxPerBooking: toInt(values.maxPerBooking),
      allPricingCategories: values.allPricingCategories,
      isDefault: values.isDefault,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: rule.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Option Price Rule" : "Add Option Price Rule"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Product</Label>
                <ProductCombobox
                  value={form.watch("productId")}
                  onChange={(value) => {
                    form.setValue("productId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue("optionId", "", { shouldDirty: true, shouldValidate: true })
                  }}
                  disabled={isEditing}
                />
                {form.formState.errors.productId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.productId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Option</Label>
                <ProductOptionCombobox
                  productId={watchedProductId}
                  value={form.watch("optionId")}
                  onChange={(value) =>
                    form.setValue("optionId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={isEditing}
                />
                {form.formState.errors.optionId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.optionId.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Catalog</Label>
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
                {form.formState.errors.priceCatalogId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.priceCatalogId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Schedule (optional)</Label>
                <PriceScheduleCombobox
                  priceCatalogId={watchedCatalogId}
                  value={form.watch("priceScheduleId")}
                  onChange={(value) =>
                    form.setValue("priceScheduleId", value ?? "", { shouldDirty: true })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cancellation policy (optional)</Label>
                <CancellationPolicyCombobox
                  value={form.watch("cancellationPolicyId")}
                  onChange={(value) =>
                    form.setValue("cancellationPolicyId", value ?? "", { shouldDirty: true })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Pricing mode</Label>
                <Select
                  items={PRICING_MODES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("pricingMode")}
                  onValueChange={(value) => form.setValue("pricingMode", value as PricingMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode} className="capitalize">
                        {mode.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Base sell</Label>
                <Input {...form.register("baseSell")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Base cost</Label>
                <Input {...form.register("baseCost")} type="number" min="0" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Min per booking</Label>
                <Input {...form.register("minPerBooking")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max per booking</Label>
                <Input {...form.register("maxPerBooking")} type="number" min="0" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} rows={2} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("allPricingCategories")}
                  onCheckedChange={(checked) => form.setValue("allPricingCategories", checked)}
                />
                <Label>All pricing categories</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <Label>Default rule</Label>
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
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} rows={2} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
