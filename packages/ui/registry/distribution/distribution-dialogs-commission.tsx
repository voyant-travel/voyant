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
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import { useDistributionUiMessagesOrDefault } from "../../../distribution-ui/src/index"
import type {
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ProductOption,
} from "./distribution-shared"
import {
  commissionScopeOptions,
  commissionTypeOptions,
  NONE_VALUE,
  nullableNumber,
  nullableString,
} from "./distribution-shared"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

function getCommissionFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    contractId: z.string().min(1, messages.dialogs.commissionRule.validation.contractRequired),
    scope: z.enum(["booking", "product", "rate", "category"]),
    productId: z.string().optional(),
    externalRateId: z.string().optional(),
    externalCategoryId: z.string().optional(),
    commissionType: z.enum(["fixed", "percentage"]),
    amountCents: z.number().nullable().optional(),
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
  const distributionMessages = useDistributionUiMessagesOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.commissionRule
  const scopeOptions = commissionScopeOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.commissionScopeLabels[option.value],
  }))
  const typeOptions = commissionTypeOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.commissionTypeLabels[option.value],
  }))
  const form = useForm({
    resolver: zodResolver(getCommissionFormSchema(messages)),
    defaultValues: {
      contractId: "",
      scope: "booking" as const,
      productId: NONE_VALUE,
      externalRateId: "",
      externalCategoryId: "",
      commissionType: "percentage" as const,
      amountCents: null,
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
        amountCents: commissionRule.amountCents ?? null,
        percentBasisPoints: commissionRule.percentBasisPoints?.toString() ?? "",
        validFrom: commissionRule.validFrom ?? "",
        validTo: commissionRule.validTo ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [commissionRule, form, open])

  const isEditing = Boolean(commissionRule)

  const onSubmit = async (values: z.output<ReturnType<typeof getCommissionFormSchema>>) => {
    const payload = {
      contractId: values.contractId,
      scope: values.scope,
      productId: values.productId === NONE_VALUE ? null : values.productId,
      externalRateId: nullableString(values.externalRateId),
      externalCategoryId: nullableString(values.externalCategoryId),
      commissionType: values.commissionType,
      amountCents: values.amountCents ?? null,
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialog.fields.contract}</Label>
                <Select
                  items={contracts.map((contract) => ({ label: contract.id, value: contract.id }))}
                  value={form.watch("contractId")}
                  onValueChange={(value) => form.setValue("contractId", value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={dialog.placeholders.selectContract} />
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
                <Label>{dialog.fields.scope}</Label>
                <Select
                  items={scopeOptions}
                  value={form.watch("scope")}
                  onValueChange={(value) =>
                    form.setValue("scope", value as ChannelCommissionRuleRow["scope"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.product}</Label>
                <Select
                  items={[
                    { label: dialog.placeholders.noProduct, value: NONE_VALUE },
                    ...products.map((product) => ({ label: product.name, value: product.id })),
                  ]}
                  value={form.watch("productId")}
                  onValueChange={(value) => form.setValue("productId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialog.placeholders.noProduct}</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.commissionType}</Label>
                <Select
                  items={typeOptions}
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
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.amountCents}</Label>
                <CurrencyInput
                  value={form.watch("amountCents") as number | null}
                  onChange={(next) =>
                    form.setValue("amountCents", next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={null}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.percentBasisPoints}</Label>
                <Input {...form.register("percentBasisPoints")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalRateId}</Label>
                <Input
                  {...form.register("externalRateId")}
                  placeholder={dialog.placeholders.externalRateId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalCategoryId}</Label>
                <Input
                  {...form.register("externalCategoryId")}
                  placeholder={dialog.placeholders.externalCategoryId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.validFrom}</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.validFrom}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.validTo}</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.validTo}
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
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialog.save : dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
