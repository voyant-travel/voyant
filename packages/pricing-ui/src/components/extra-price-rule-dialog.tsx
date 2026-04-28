"use client"

import { type ExtraPriceRuleRecord, useExtraPriceRuleMutation } from "@voyantjs/pricing-react"
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

import { OptionPriceRuleCombobox } from "./option-price-rule-combobox"

const ADDON_PRICING_MODES = [
  "included",
  "per_person",
  "per_booking",
  "on_request",
  "unavailable",
] as const
type AddonPricingMode = (typeof ADDON_PRICING_MODES)[number]

const formSchema = z.object({
  optionPriceRuleId: z.string().min(1, "Option price rule is required"),
  optionId: z.string().min(1, "Option ID is required"),
  productExtraId: z.string().optional().nullable(),
  optionExtraConfigId: z.string().optional().nullable(),
  pricingMode: z.enum(ADDON_PRICING_MODES),
  sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: ExtraPriceRuleRecord
  onSuccess?: (rule: ExtraPriceRuleRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null

export function ExtraPriceRuleDialog({ open, onOpenChange, rule, onSuccess }: Props) {
  const isEditing = !!rule
  const { create, update } = useExtraPriceRuleMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionPriceRuleId: "",
      optionId: "",
      productExtraId: "",
      optionExtraConfigId: "",
      pricingMode: "included",
      sellAmount: "",
      costAmount: "",
      active: true,
      sortOrder: 0,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        optionPriceRuleId: rule.optionPriceRuleId,
        optionId: rule.optionId,
        productExtraId: rule.productExtraId ?? "",
        optionExtraConfigId: rule.optionExtraConfigId ?? "",
        pricingMode: rule.pricingMode,
        sellAmount: rule.sellAmountCents != null ? rule.sellAmountCents / 100 : "",
        costAmount: rule.costAmountCents != null ? rule.costAmountCents / 100 : "",
        active: rule.active,
        sortOrder: rule.sortOrder,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, rule])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionPriceRuleId: values.optionPriceRuleId,
      optionId: values.optionId,
      productExtraId: values.productExtraId || null,
      optionExtraConfigId: values.optionExtraConfigId || null,
      pricingMode: values.pricingMode,
      sellAmountCents: toCents(values.sellAmount),
      costAmountCents: toCents(values.costAmount),
      active: values.active,
      sortOrder: values.sortOrder,
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
          <DialogTitle>{isEditing ? "Edit Extra Price Rule" : "Add Extra Price Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Option price rule</Label>
              <OptionPriceRuleCombobox
                value={form.watch("optionPriceRuleId")}
                onChange={(value) =>
                  form.setValue("optionPriceRuleId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={isEditing}
              />
              {form.formState.errors.optionPriceRuleId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionPriceRuleId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Option ID</Label>
                <Input {...form.register("optionId")} placeholder="popt_…" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Product extra ID (optional)</Label>
                <Input {...form.register("productExtraId")} placeholder="pext_…" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Option extra config ID (optional)</Label>
              <Input {...form.register("optionExtraConfigId")} placeholder="oecf_…" />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Pricing mode</Label>
              <Select
                items={ADDON_PRICING_MODES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                value={form.watch("pricingMode")}
                onValueChange={(value) => form.setValue("pricingMode", value as AddonPricingMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDON_PRICING_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode} className="capitalize">
                      {mode.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell amount</Label>
                <Input {...form.register("sellAmount")} type="number" step="0.01" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cost amount</Label>
                <Input {...form.register("costAmount")} type="number" step="0.01" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
