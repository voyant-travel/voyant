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
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSellabilityUiMessagesOrDefault } from "../i18n/index.js"
import { type SellabilityPolicyRecord, useSellabilityPolicyMutation } from "../index.js"
import { ChannelCombobox } from "./channel-combobox.js"
import { MarketCombobox } from "./market-combobox.js"
import { ProductCombobox } from "./product-combobox.js"
import { ProductOptionCombobox } from "./product-option-combobox.js"

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

function createFormSchema(messages: ReturnType<typeof useSellabilityUiMessagesOrDefault>) {
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
    { message: messages.policyDialog.validation.jsonObject },
  )

  return z.object({
    name: z.string().min(1, messages.policyDialog.validation.nameRequired).max(255),
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
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: SellabilityPolicyRecord
  onSuccess?: (policy: SellabilityPolicyRecord) => void
}

export function PolicyDialog({ open, onOpenChange, policy, onSuccess }: Props) {
  const isEditing = !!policy
  const { create, update } = useSellabilityPolicyMutation()
  const messages = useSellabilityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? messages.policyDialog.titles.edit : messages.policyDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.name}</Label>
              <Input
                {...form.register("name")}
                placeholder={messages.policyDialog.placeholders.name}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.scope}</Label>
                <Select
                  items={POLICY_SCOPES.map((value) => ({
                    label: messages.common.policyScopeLabels[value],
                    value,
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(value) => form.setValue("scope", value as PolicyScope)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_SCOPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.common.policyScopeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.type}</Label>
                <Select
                  items={POLICY_TYPES.map((value) => ({
                    label: messages.common.policyTypeLabels[value],
                    value,
                  }))}
                  value={form.watch("policyType")}
                  onValueChange={(value) => form.setValue("policyType", value as PolicyType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.common.policyTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.priority}</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            {scope === "product" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.product}</Label>
                <ProductCombobox
                  value={form.watch("productId") ?? null}
                  onChange={(value) => form.setValue("productId", value)}
                />
              </div>
            ) : null}

            {scope === "option" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{messages.policyDialog.fields.product}</Label>
                  <ProductCombobox
                    value={form.watch("productId") ?? null}
                    onChange={(value) => {
                      form.setValue("productId", value)
                      form.setValue("optionId", null)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.policyDialog.fields.option}</Label>
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
                <Label>{messages.policyDialog.fields.market}</Label>
                <MarketCombobox
                  value={form.watch("marketId") ?? null}
                  onChange={(value) => form.setValue("marketId", value)}
                />
              </div>
            ) : null}

            {scope === "channel" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.channel}</Label>
                <ChannelCombobox
                  value={form.watch("channelId") ?? null}
                  onChange={(value) => form.setValue("channelId", value)}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyDialog.fields.conditionsJson}</Label>
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
                <Label>{messages.policyDialog.fields.effectsJson}</Label>
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
              <Label>{messages.policyDialog.fields.active}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.policyDialog.actions.save
                : messages.policyDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
