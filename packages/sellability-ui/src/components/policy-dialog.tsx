import {
  type SellabilityPolicyRecord,
  useSellabilityPolicyMutation,
} from "@voyantjs/sellability-react"
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

import { ChannelCombobox } from "./channel-combobox"
import { MarketCombobox } from "./market-combobox"
import { ProductCombobox } from "./product-combobox"
import { ProductOptionCombobox } from "./product-option-combobox"

const POLICY_SCOPES = ["global", "product", "option", "market", "channel"] as const
const POLICY_TYPES = [
  "capability",
  "occupancy",
  "pickup",
  "question",
  "allotment",
  "availability_window",
  "currency",
  "custom",
] as const

type PolicyScope = (typeof POLICY_SCOPES)[number]
type PolicyType = (typeof POLICY_TYPES)[number]

const jsonStringSchema = z.string().refine(
  (value) => {
    if (!value || value.trim() === "") return true
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    } catch {
      return false
    }
  },
  { message: "Must be a JSON object" },
)

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  scope: z.enum(POLICY_SCOPES),
  policyType: z.enum(POLICY_TYPES),
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  marketId: z.string().optional().nullable(),
  channelId: z.string().optional().nullable(),
  priority: z.coerce.number().int(),
  active: z.boolean(),
  conditionsJson: jsonStringSchema,
  effectsJson: jsonStringSchema,
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: SellabilityPolicyRecord
  onSuccess?: (policy: SellabilityPolicyRecord) => void
}

export function PolicyDialog({ open, onOpenChange, policy, onSuccess }: Props) {
  const isEditing = !!policy
  const { create, update } = useSellabilityPolicyMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      scope: "global",
      policyType: "custom",
      productId: "",
      optionId: "",
      marketId: "",
      channelId: "",
      priority: 0,
      active: true,
      conditionsJson: "{}",
      effectsJson: "{}",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && policy) {
      form.reset({
        name: policy.name,
        scope: policy.scope,
        policyType: policy.policyType,
        productId: policy.productId ?? "",
        optionId: policy.optionId ?? "",
        marketId: policy.marketId ?? "",
        channelId: policy.channelId ?? "",
        priority: policy.priority,
        active: policy.active,
        conditionsJson: JSON.stringify(policy.conditions ?? {}, null, 2),
        effectsJson: JSON.stringify(policy.effects ?? {}, null, 2),
        notes: policy.notes ?? "",
      })
    } else if (open) {
      form.reset({
        name: "",
        scope: "global",
        policyType: "custom",
        productId: "",
        optionId: "",
        marketId: "",
        channelId: "",
        priority: 0,
        active: true,
        conditionsJson: "{}",
        effectsJson: "{}",
        notes: "",
      })
    }
  }, [form, open, policy])

  const scope = form.watch("scope")
  const isSubmitting = create.isPending || update.isPending

  const onSubmit = async (values: FormOutput) => {
    const parseJson = (value: string): Record<string, unknown> => {
      if (!value || value.trim() === "") return {}
      return JSON.parse(value) as Record<string, unknown>
    }

    const payload = {
      name: values.name,
      scope: values.scope,
      policyType: values.policyType,
      productId: values.productId || null,
      optionId: values.optionId || null,
      marketId: values.marketId || null,
      channelId: values.channelId || null,
      priority: values.priority,
      active: values.active,
      conditions: parseJson(values.conditionsJson),
      effects: parseJson(values.effectsJson),
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: policy.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Policy" : "Add Policy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Block bookings without capability" />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={POLICY_SCOPES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("scope")}
                  onValueChange={(value) => form.setValue("scope", value as PolicyScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_SCOPES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  items={POLICY_TYPES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("policyType")}
                  onValueChange={(value) => form.setValue("policyType", value as PolicyType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((value) => (
                      <SelectItem key={value} value={value} className="capitalize">
                        {value.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            {scope === "product" ? (
              <div className="flex flex-col gap-2">
                <Label>Product</Label>
                <ProductCombobox
                  value={form.watch("productId") ?? null}
                  onChange={(value) => form.setValue("productId", value)}
                />
              </div>
            ) : null}

            {scope === "option" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Product</Label>
                  <ProductCombobox
                    value={form.watch("productId") ?? null}
                    onChange={(value) => {
                      form.setValue("productId", value)
                      form.setValue("optionId", null)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Option</Label>
                  <ProductOptionCombobox
                    productId={form.watch("productId")}
                    value={form.watch("optionId") ?? null}
                    onChange={(value) => form.setValue("optionId", value)}
                  />
                </div>
              </div>
            ) : null}

            {scope === "market" ? (
              <div className="flex flex-col gap-2">
                <Label>Market</Label>
                <MarketCombobox
                  value={form.watch("marketId") ?? null}
                  onChange={(value) => form.setValue("marketId", value)}
                />
              </div>
            ) : null}

            {scope === "channel" ? (
              <div className="flex flex-col gap-2">
                <Label>Channel</Label>
                <ChannelCombobox
                  value={form.watch("channelId") ?? null}
                  onChange={(value) => form.setValue("channelId", value)}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Conditions (JSON)</Label>
                <Textarea
                  {...form.register("conditionsJson")}
                  rows={6}
                  className="font-mono text-xs"
                />
                {form.formState.errors.conditionsJson ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.conditionsJson.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Effects (JSON)</Label>
                <Textarea
                  {...form.register("effectsJson")}
                  rows={6}
                  className="font-mono text-xs"
                />
                {form.formState.errors.effectsJson ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.effectsJson.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(value) => form.setValue("active", value)}
              />
              <Label>Active</Label>
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
              {isEditing ? "Save Changes" : "Add Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
