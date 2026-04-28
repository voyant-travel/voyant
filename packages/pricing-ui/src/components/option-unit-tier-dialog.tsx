"use client"

import { type OptionUnitTierRecord, useOptionUnitTierMutation } from "@voyantjs/pricing-react"
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
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const formSchema = z.object({
  optionUnitPriceRuleId: z.string().min(1, "Option unit price rule is required"),
  minQuantity: z.coerce.number().int().min(1, "Min quantity must be at least 1"),
  maxQuantity: z.coerce.number().int().min(1).optional().or(z.literal("")).nullable(),
  sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier?: OptionUnitTierRecord
  onSuccess?: (tier: OptionUnitTierRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null
const toInt = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? value : null

export function OptionUnitTierDialog({ open, onOpenChange, tier, onSuccess }: Props) {
  const isEditing = !!tier
  const { create, update } = useOptionUnitTierMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionUnitPriceRuleId: "",
      minQuantity: 1,
      maxQuantity: "",
      sellAmount: "",
      costAmount: "",
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && tier) {
      form.reset({
        optionUnitPriceRuleId: tier.optionUnitPriceRuleId,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity ?? "",
        sellAmount: tier.sellAmountCents != null ? tier.sellAmountCents / 100 : "",
        costAmount: tier.costAmountCents != null ? tier.costAmountCents / 100 : "",
        active: tier.active,
        sortOrder: tier.sortOrder,
      })
    } else if (open) {
      form.reset({
        optionUnitPriceRuleId: "",
        minQuantity: 1,
        maxQuantity: "",
        sellAmount: "",
        costAmount: "",
        active: true,
        sortOrder: 0,
      })
    }
  }, [open, tier, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionUnitPriceRuleId: values.optionUnitPriceRuleId,
      minQuantity: values.minQuantity,
      maxQuantity: toInt(values.maxQuantity),
      sellAmountCents: toCents(values.sellAmount),
      costAmountCents: toCents(values.costAmount),
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: tier.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Unit Tier" : "Add Unit Tier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Option unit price rule ID</Label>
              <Input
                {...form.register("optionUnitPriceRuleId")}
                placeholder="oupr_…"
                disabled={isEditing}
              />
              {form.formState.errors.optionUnitPriceRuleId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionUnitPriceRuleId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Min quantity</Label>
                <Input {...form.register("minQuantity")} type="number" min="1" />
                {form.formState.errors.minQuantity ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.minQuantity.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max quantity</Label>
                <Input {...form.register("maxQuantity")} type="number" min="1" />
              </div>
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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Tier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
