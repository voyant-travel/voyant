"use client"

import {
  type CancellationPolicyRecord,
  useCancellationPolicyMutation,
} from "@voyantjs/pricing-react"
import { usePricingUiMessagesOrDefault } from "@voyantjs/pricing-ui"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryPricingMessagesOrDefault } from "./i18n"

function createPolicyFormSchema(
  messages: ReturnType<typeof useRegistryPricingMessagesOrDefault>["cancellationPolicyDialog"],
) {
  return z.object({
    name: z.string().min(1, messages.validation.nameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    policyType: z.enum(["simple", "advanced", "non_refundable", "custom"]),
    simpleCutoffHours: z
      .union([z.coerce.number().int().min(0, messages.validation.simpleCutoffMin), z.literal("")])
      .nullable(),
    isDefault: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

export interface CancellationPolicyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: CancellationPolicyRecord
  onSuccess?: (policy: CancellationPolicyRecord) => void
}

export function CancellationPolicyDialog({
  open,
  onOpenChange,
  policy,
  onSuccess,
}: CancellationPolicyDialogProps) {
  const sharedMessages = usePricingUiMessagesOrDefault()
  const registryMessages = useRegistryPricingMessagesOrDefault()
  const dialogMessages = registryMessages.cancellationPolicyDialog
  const formSchema = createPolicyFormSchema(dialogMessages)
  const isEditing = !!policy
  const { create, update } = useCancellationPolicyMutation()

  type PolicyFormValues = z.input<typeof formSchema>
  type PolicyFormOutput = z.output<typeof formSchema>

  const policyTypes = ["simple", "advanced", "non_refundable", "custom"] as const

  const form = useForm<PolicyFormValues, unknown, PolicyFormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      policyType: "custom",
      simpleCutoffHours: "",
      isDefault: false,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && policy) {
      form.reset({
        name: policy.name,
        code: policy.code ?? "",
        policyType: policy.policyType,
        simpleCutoffHours: policy.simpleCutoffHours ?? "",
        isDefault: policy.isDefault,
        active: policy.active,
        notes: policy.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, policy])

  const onSubmit = async (values: PolicyFormOutput) => {
    const payload = {
      name: values.name,
      code: values.code || null,
      policyType: values.policyType,
      simpleCutoffHours:
        typeof values.simpleCutoffHours === "number" ? values.simpleCutoffHours : null,
      isDefault: values.isDefault,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: policy.id, input: payload })
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
            {isEditing ? dialogMessages.titles.edit : dialogMessages.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.code}</Label>
                <Input {...form.register("code")} placeholder={dialogMessages.placeholders.code} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.type}</Label>
                <Select
                  items={policyTypes.map((value) => ({
                    label: dialogMessages.policyTypeLabels[value],
                    value,
                  }))}
                  value={form.watch("policyType")}
                  onValueChange={(value) =>
                    form.setValue("policyType", value as PolicyFormValues["policyType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {policyTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {dialogMessages.policyTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.watch("policyType") === "simple" ? (
                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.fields.simpleCutoffHours}</Label>
                  <Input {...form.register("simpleCutoffHours")} type="number" min="0" />
                  {form.formState.errors.simpleCutoffHours ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.simpleCutoffHours.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <Label>{dialogMessages.fields.defaultPolicy}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{dialogMessages.fields.active}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={dialogMessages.placeholders.notes}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {sharedMessages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? sharedMessages.common.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
