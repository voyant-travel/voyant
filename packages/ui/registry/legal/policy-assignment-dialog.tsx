import {
  type LegalPolicyAssignmentRecord,
  useLegalPolicyAssignmentMutation,
} from "@voyantjs/legal-react"
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
} from "@/components/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  policyId: string
  scope: "product" | "channel" | "supplier" | "market" | "organization" | "global"
  productId?: string
  channelId?: string
  supplierId?: string
  marketId?: string
  organizationId?: string
  validFrom?: string
  validTo?: string
  priority?: number
}

export type AssignmentData = LegalPolicyAssignmentRecord

type PolicyAssignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  assignment?: AssignmentData
  onSuccess: () => void
}

function createAssignmentFormSchema(
  messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>,
) {
  return z.object({
    policyId: z.string().min(1, messages.policyAssignmentDialog.validation.policyIdRequired),
    scope: z.enum(["product", "channel", "supplier", "market", "organization", "global"]),
    productId: z.string().optional(),
    channelId: z.string().optional(),
    supplierId: z.string().optional(),
    marketId: z.string().optional(),
    organizationId: z.string().optional(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    priority: z.coerce.number().int().optional(),
  })
}

const SCOPES = ["product", "channel", "supplier", "market", "organization", "global"] as const

export function PolicyAssignmentDialog({
  open,
  onOpenChange,
  policyId,
  assignment,
  onSuccess,
}: PolicyAssignmentDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const assignmentFormSchema = createAssignmentFormSchema(messages)
  const isEditing = !!assignment
  const { create, update } = useLegalPolicyAssignmentMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      policyId,
      scope: "global",
      productId: "",
      channelId: "",
      supplierId: "",
      marketId: "",
      organizationId: "",
      validFrom: "",
      validTo: "",
      priority: 0,
    },
  })

  useEffect(() => {
    if (open && assignment) {
      form.reset({
        policyId: assignment.policyId,
        scope: assignment.scope as FormValues["scope"],
        productId: assignment.productId ?? "",
        channelId: assignment.channelId ?? "",
        supplierId: assignment.supplierId ?? "",
        marketId: assignment.marketId ?? "",
        organizationId: assignment.organizationId ?? "",
        validFrom: assignment.validFrom ?? "",
        validTo: assignment.validTo ?? "",
        priority: assignment.priority,
      })
    } else if (open) {
      form.reset({ policyId, scope: "global", priority: 0 })
    }
  }, [open, assignment, policyId, form])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      policyId: values.policyId,
      scope: values.scope,
      productId: values.productId || undefined,
      channelId: values.channelId || undefined,
      supplierId: values.supplierId || undefined,
      marketId: values.marketId || undefined,
      organizationId: values.organizationId || undefined,
      validFrom: values.validFrom || undefined,
      validTo: values.validTo || undefined,
      priority: values.priority ?? 0,
    }

    if (isEditing && assignment) {
      await update.mutateAsync({ id: assignment.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const watchedScope = form.watch("scope")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.policyAssignmentDialog.titles.edit
              : messages.policyAssignmentDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.scope}</Label>
                <Select
                  items={SCOPES.map((item) => ({
                    label: messages.policyAssignmentDialog.scopeLabels[item],
                    value: item,
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {messages.policyAssignmentDialog.scopeLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.priority}</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            {watchedScope === "product" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.productId}</Label>
                <Input
                  {...form.register("productId")}
                  placeholder={messages.policyAssignmentDialog.placeholders.productId}
                />
              </div>
            ) : null}
            {watchedScope === "channel" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.channelId}</Label>
                <Input
                  {...form.register("channelId")}
                  placeholder={messages.policyAssignmentDialog.placeholders.channelId}
                />
              </div>
            ) : null}
            {watchedScope === "supplier" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.supplierId}</Label>
                <Input
                  {...form.register("supplierId")}
                  placeholder={messages.policyAssignmentDialog.placeholders.supplierId}
                />
              </div>
            ) : null}
            {watchedScope === "market" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.marketId}</Label>
                <Input
                  {...form.register("marketId")}
                  placeholder={messages.policyAssignmentDialog.placeholders.marketId}
                />
              </div>
            ) : null}
            {watchedScope === "organization" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.organizationId}</Label>
                <Input
                  {...form.register("organizationId")}
                  placeholder={messages.policyAssignmentDialog.placeholders.organizationId}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.validFrom}</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.validFrom}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.validTo}</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.validTo}
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing
                ? messages.common.saveChanges
                : messages.policyAssignmentDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
