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
import { EntityCombobox } from "@/components/ui/entity-combobox"
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

type ProductRef = { id: string; name: string; status?: string | null; bookingMode?: string | null }
type ChannelRef = { id: string; name: string; kind?: string | null; status?: string | null }
type SupplierRef = { id: string; name: string; city?: string | null; country?: string | null }
type MarketRef = { id: string; name: string; code?: string | null; defaultCurrency?: string | null }
type OrganizationRef = {
  id: string
  name: string
  website?: string | null
  industry?: string | null
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
  const setReferenceField = (
    field: "productId" | "channelId" | "supplierId" | "marketId" | "organizationId",
    value: string | null,
  ) => {
    form.setValue(field, value ?? "", { shouldDirty: true, shouldValidate: true })
  }

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
                  onValueChange={(v) => {
                    form.setValue("scope", v as FormValues["scope"], {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue("productId", "")
                    form.setValue("channelId", "")
                    form.setValue("supplierId", "")
                    form.setValue("marketId", "")
                    form.setValue("organizationId", "")
                  }}
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
                <EntityCombobox<ProductRef>
                  value={form.watch("productId") || null}
                  onChange={(id) => setReferenceField("productId", id)}
                  endpoint="/v1/products"
                  detailEndpoint="/v1/products/:id"
                  queryKey={["legal", "policy-assignment", "products"]}
                  getLabel={(product) => product.name}
                  getSecondary={(product) =>
                    [product.status, product.bookingMode].filter(Boolean).join(" · ") || undefined
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.productId}
                />
              </div>
            ) : null}
            {watchedScope === "channel" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.channelId}</Label>
                <EntityCombobox<ChannelRef>
                  value={form.watch("channelId") || null}
                  onChange={(id) => setReferenceField("channelId", id)}
                  endpoint="/v1/distribution/channels"
                  detailEndpoint="/v1/distribution/channels/:id"
                  queryKey={["legal", "policy-assignment", "channels"]}
                  getLabel={(channel) => channel.name}
                  getSecondary={(channel) =>
                    [channel.kind, channel.status].filter(Boolean).join(" · ") || undefined
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.channelId}
                />
              </div>
            ) : null}
            {watchedScope === "supplier" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.supplierId}</Label>
                <EntityCombobox<SupplierRef>
                  value={form.watch("supplierId") || null}
                  onChange={(id) => setReferenceField("supplierId", id)}
                  endpoint="/v1/suppliers"
                  detailEndpoint="/v1/suppliers/:id"
                  queryKey={["legal", "policy-assignment", "suppliers"]}
                  getLabel={(supplier) => supplier.name}
                  getSecondary={(supplier) =>
                    [supplier.city, supplier.country].filter(Boolean).join(" · ") || undefined
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.supplierId}
                />
              </div>
            ) : null}
            {watchedScope === "market" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.marketId}</Label>
                <EntityCombobox<MarketRef>
                  value={form.watch("marketId") || null}
                  onChange={(id) => setReferenceField("marketId", id)}
                  endpoint="/v1/markets/markets"
                  detailEndpoint="/v1/markets/markets/:id"
                  queryKey={["legal", "policy-assignment", "markets"]}
                  getLabel={(market) => market.name}
                  getSecondary={(market) =>
                    [market.code, market.defaultCurrency].filter(Boolean).join(" · ") || undefined
                  }
                  placeholder={messages.policyAssignmentDialog.placeholders.marketId}
                />
              </div>
            ) : null}
            {watchedScope === "organization" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.policyAssignmentDialog.fields.organizationId}</Label>
                <EntityCombobox<OrganizationRef>
                  value={form.watch("organizationId") || null}
                  onChange={(id) => setReferenceField("organizationId", id)}
                  endpoint="/v1/crm/organizations"
                  detailEndpoint="/v1/crm/organizations/:id"
                  queryKey={["legal", "policy-assignment", "organizations"]}
                  getLabel={(organization) => organization.name}
                  getSecondary={(organization) =>
                    [organization.website, organization.industry].filter(Boolean).join(" · ") ||
                    undefined
                  }
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
