import type {
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ProductOption,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  commissionScopeOptions,
  commissionTypeOptions,
  NONE_VALUE,
  nullableNumber,
  nullableString,
} from "@voyantjs/distribution-ui/components/distribution-shared"
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
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

function createCommissionFormSchema(contractRequired: string) {
  return z.object({
    contractId: z.string().min(1, contractRequired),
    scope: z.enum(["booking", "product", "rate", "category"]),
    productId: z.string().optional(),
    externalRateId: z.string().optional(),
    externalCategoryId: z.string().optional(),
    commissionType: z.enum(["fixed", "percentage"]),
    amountCents: z.string().optional(),
    percentBasisPoints: z.string().optional(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
  })
}

export function ChannelCommissionRuleDialog({
  open,
  onOpenChange,
  commissionRule,
  contracts,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commissionRule?: ChannelCommissionRuleRow
  contracts: ChannelContractRow[]
  products: ProductOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.commission
  const commissionFormSchema = useMemo(
    () => createCommissionFormSchema(dialogMessages.validation.contractRequired),
    [dialogMessages.validation.contractRequired],
  )
  const form = useForm({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: {
      contractId: "",
      scope: "booking" as const,
      productId: NONE_VALUE,
      externalRateId: "",
      externalCategoryId: "",
      commissionType: "percentage" as const,
      amountCents: "",
      percentBasisPoints: "",
      validFrom: "",
      validTo: "",
    },
  })

  useEffect(() => {
    if (open && commissionRule) {
      form.reset({
        contractId: commissionRule.contractId,
        scope: commissionRule.scope,
        productId: commissionRule.productId ?? NONE_VALUE,
        externalRateId: commissionRule.externalRateId ?? "",
        externalCategoryId: commissionRule.externalCategoryId ?? "",
        commissionType: commissionRule.commissionType,
        amountCents: commissionRule.amountCents?.toString() ?? "",
        percentBasisPoints: commissionRule.percentBasisPoints?.toString() ?? "",
        validFrom: commissionRule.validFrom ?? "",
        validTo: commissionRule.validTo ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [commissionRule, form, open])

  const isEditing = Boolean(commissionRule)

  const onSubmit = async (values: z.output<typeof commissionFormSchema>) => {
    const payload = {
      contractId: values.contractId,
      scope: values.scope,
      productId: values.productId === NONE_VALUE ? null : values.productId,
      externalRateId: nullableString(values.externalRateId),
      externalCategoryId: nullableString(values.externalCategoryId),
      commissionType: values.commissionType,
      amountCents: nullableNumber(values.amountCents),
      percentBasisPoints: nullableNumber(values.percentBasisPoints),
      validFrom: nullableString(values.validFrom),
      validTo: nullableString(values.validTo),
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/commission-rules/${commissionRule?.id}`, payload)
    } else {
      await api.post("/v1/distribution/commission-rules", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.contract}</Label>
                <Select
                  items={contracts.map((contract) => ({ label: contract.id, value: contract.id }))}
                  value={form.watch("contractId")}
                  onValueChange={(value) => form.setValue("contractId", value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={dialogMessages.placeholders.selectContract} />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.scope}</Label>
                <Select
                  items={commissionScopeOptions}
                  value={form.watch("scope")}
                  onValueChange={(value) =>
                    form.setValue("scope", value as ChannelCommissionRuleRow["scope"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionScopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.distribution.values.commissionScope[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.product}</Label>
                <Select
                  value={form.watch("productId")}
                  onValueChange={(value) => form.setValue("productId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      {dialogMessages.placeholders.noProduct}
                    </SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.commissionType}</Label>
                <Select
                  items={commissionTypeOptions}
                  value={form.watch("commissionType")}
                  onValueChange={(value) =>
                    form.setValue(
                      "commissionType",
                      value as ChannelCommissionRuleRow["commissionType"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.distribution.values.commissionType[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.amountCents}</Label>
                <Input {...form.register("amountCents")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.percentBasisPoints}</Label>
                <Input {...form.register("percentBasisPoints")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalRateId}</Label>
                <Input
                  {...form.register("externalRateId")}
                  placeholder={dialogMessages.placeholders.externalRateId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalCategoryId}</Label>
                <Input
                  {...form.register("externalCategoryId")}
                  placeholder={dialogMessages.placeholders.externalCategoryId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.validFrom}</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.validFrom}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.validTo}</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.validTo}
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.actions.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.actions.save : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
