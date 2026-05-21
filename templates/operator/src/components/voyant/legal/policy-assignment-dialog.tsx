import {
  type LegalPolicyAssignmentRecord,
  useLegalPolicyAssignmentMutation,
} from "@voyantjs/legal-react"
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
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const SCOPE_VALUES = ["product", "channel", "supplier", "market", "organization", "global"] as const
type AssignmentScope = (typeof SCOPE_VALUES)[number]

const assignmentFormSchema = z.object({
  policyId: z.string().min(1, "policyIdRequired"),
  scope: z.enum(SCOPE_VALUES),
  productId: z.string().optional(),
  channelId: z.string().optional(),
  supplierId: z.string().optional(),
  marketId: z.string().optional(),
  organizationId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  priority: z.coerce.number().int().optional(),
})

type FormValues = z.input<typeof assignmentFormSchema>
type FormOutput = z.output<typeof assignmentFormSchema>

export type AssignmentData = LegalPolicyAssignmentRecord

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

type PolicyAssignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  assignment?: AssignmentData
  onSuccess: () => void
}

export function PolicyAssignmentDialog({
  open,
  onOpenChange,
  policyId,
  assignment,
  onSuccess,
}: PolicyAssignmentDialogProps) {
  const isEditing = !!assignment
  const t = useAdminMessages().legal.policyAssignmentDialog
  const { create, update } = useLegalPolicyAssignmentMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
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

  const onSubmit = async (values: FormOutput) => {
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
          <DialogTitle>{isEditing ? t.titleEdit : t.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.scopeLabel}</Label>
                <Select
                  items={SCOPE_VALUES.map((value) => ({ value, label: t.scopeOptions[value] }))}
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
                    {SCOPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t.scopeOptions[value as AssignmentScope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.priorityLabel}</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            {watchedScope === "product" && (
              <div className="flex flex-col gap-2">
                <Label>{t.productLabel}</Label>
                <EntityCombobox<ProductRef>
                  value={form.watch("productId") || null}
                  onChange={(id) => setReferenceField("productId", id)}
                  endpoint="/v1/products"
                  detailEndpoint="/v1/products/:id"
                  queryKey={["legal", "policy-assignment", "products"]}
                  getLabel={(product) => product.name}
                  getSecondary={(product) =>
                    [product.status, product.bookingMode].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder={t.productSearchPlaceholder}
                />
              </div>
            )}
            {watchedScope === "channel" && (
              <div className="flex flex-col gap-2">
                <Label>{t.channelLabel}</Label>
                <EntityCombobox<ChannelRef>
                  value={form.watch("channelId") || null}
                  onChange={(id) => setReferenceField("channelId", id)}
                  endpoint="/v1/distribution/channels"
                  detailEndpoint="/v1/distribution/channels/:id"
                  queryKey={["legal", "policy-assignment", "channels"]}
                  getLabel={(channel) => channel.name}
                  getSecondary={(channel) =>
                    [channel.kind, channel.status].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder={t.channelSearchPlaceholder}
                />
              </div>
            )}
            {watchedScope === "supplier" && (
              <div className="flex flex-col gap-2">
                <Label>{t.supplierLabel}</Label>
                <EntityCombobox<SupplierRef>
                  value={form.watch("supplierId") || null}
                  onChange={(id) => setReferenceField("supplierId", id)}
                  endpoint="/v1/suppliers"
                  detailEndpoint="/v1/suppliers/:id"
                  queryKey={["legal", "policy-assignment", "suppliers"]}
                  getLabel={(supplier) => supplier.name}
                  getSecondary={(supplier) =>
                    [supplier.city, supplier.country].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder={t.supplierSearchPlaceholder}
                />
              </div>
            )}
            {watchedScope === "market" && (
              <div className="flex flex-col gap-2">
                <Label>{t.marketLabel}</Label>
                <EntityCombobox<MarketRef>
                  value={form.watch("marketId") || null}
                  onChange={(id) => setReferenceField("marketId", id)}
                  endpoint="/v1/markets/markets"
                  detailEndpoint="/v1/markets/markets/:id"
                  queryKey={["legal", "policy-assignment", "markets"]}
                  getLabel={(market) => market.name}
                  getSecondary={(market) =>
                    [market.code, market.defaultCurrency].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder={t.marketSearchPlaceholder}
                />
              </div>
            )}
            {watchedScope === "organization" && (
              <div className="flex flex-col gap-2">
                <Label>{t.organizationLabel}</Label>
                <EntityCombobox<OrganizationRef>
                  value={form.watch("organizationId") || null}
                  onChange={(id) => setReferenceField("organizationId", id)}
                  endpoint="/v1/crm/organizations"
                  detailEndpoint="/v1/crm/organizations/:id"
                  queryKey={["legal", "policy-assignment", "organizations"]}
                  getLabel={(organization) => organization.name}
                  getSecondary={(organization) =>
                    [organization.website, organization.industry].filter(Boolean).join(" / ") ||
                    undefined
                  }
                  placeholder={t.organizationSearchPlaceholder}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.validFromLabel}</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={t.validFromPlaceholder}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.validToLabel}</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={t.validToPlaceholder}
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t.saveChanges : t.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
