"use client"

import { useOperatorAdminMessages } from "@voyant-travel/admin"
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
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  allocationModeOptions,
  NONE_VALUE,
  type ProductOption,
  type ResourceAllocationRow,
  type ResourcePoolRow,
  type RuleOption,
  type StartTimeOption,
  useVoyantResourcesContext,
} from "../index.js"

import { sendResourcesMutation } from "./resources-admin-api.js"

const getAllocationFormSchema = (messages: ReturnType<typeof useOperatorAdminMessages>) =>
  z.object({
    poolId: z.string().min(1, messages.resources.dialogs.allocation.validationPoolRequired),
    productId: z.string().min(1, messages.resources.dialogs.allocation.validationProductRequired),
    availabilityRuleId: z.string().optional(),
    startTimeId: z.string().optional(),
    quantityRequired: z.coerce.number().int().min(1),
    allocationMode: z.enum(["shared", "exclusive"]),
    priority: z.coerce.number().int(),
  })

export function ResourceAllocationDialog({
  open,
  onOpenChange,
  allocation,
  pools,
  products,
  rules,
  startTimes,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  allocation?: ResourceAllocationRow
  pools: ResourcePoolRow[]
  products: ProductOption[]
  rules: RuleOption[]
  startTimes: StartTimeOption[]
  onSuccess: () => void
}) {
  const client = useVoyantResourcesContext()
  const messages = useOperatorAdminMessages()
  const dialogMessages = messages.resources.dialogs.allocation
  const allocationFormSchema = getAllocationFormSchema(messages)
  const form = useForm({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      poolId: "",
      productId: "",
      availabilityRuleId: NONE_VALUE,
      startTimeId: NONE_VALUE,
      quantityRequired: 1,
      allocationMode: "shared" as const,
      priority: 0,
    },
  })

  useEffect(() => {
    if (open && allocation) {
      form.reset({
        poolId: allocation.poolId,
        productId: allocation.productId,
        availabilityRuleId: allocation.availabilityRuleId ?? NONE_VALUE,
        startTimeId: allocation.startTimeId ?? NONE_VALUE,
        quantityRequired: allocation.quantityRequired,
        allocationMode: allocation.allocationMode,
        priority: allocation.priority,
      })
    } else if (open) {
      form.reset()
    }
  }, [allocation, form, open])

  const selectedProductId = form.watch("productId")
  const filteredRules = rules.filter((rule) => rule.productId === selectedProductId)
  const filteredStartTimes = startTimes.filter(
    (startTime) => startTime.productId === selectedProductId,
  )
  const isEditing = Boolean(allocation)

  const onSubmit = async (values: z.output<typeof allocationFormSchema>) => {
    const payload = {
      poolId: values.poolId,
      productId: values.productId,
      availabilityRuleId:
        values.availabilityRuleId === NONE_VALUE ? null : values.availabilityRuleId,
      startTimeId: values.startTimeId === NONE_VALUE ? null : values.startTimeId,
      quantityRequired: values.quantityRequired,
      allocationMode: values.allocationMode,
      priority: values.priority,
    }

    if (isEditing) {
      await sendResourcesMutation(
        client,
        "PATCH",
        `/v1/admin/operations/allocations/${allocation?.id}`,
        payload,
      )
    } else {
      await sendResourcesMutation(client, "POST", "/v1/admin/operations/allocations", payload)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialogMessages.editTitle : dialogMessages.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.poolLabel}</Label>
              <Select
                items={pools.map((pool) => ({ label: pool.name, value: pool.id }))}
                value={form.watch("poolId")}
                onValueChange={(value) => form.setValue("poolId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.selectPoolPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.productLabel}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.selectProductPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.ruleLabel}</Label>
                <Select
                  value={form.watch("availabilityRuleId")}
                  onValueChange={(value) =>
                    form.setValue("availabilityRuleId", value ?? NONE_VALUE)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialogMessages.noRule}</SelectItem>
                    {filteredRules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.recurrenceRule}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.startTimeLabel}</Label>
                <Select
                  value={form.watch("startTimeId")}
                  onValueChange={(value) => form.setValue("startTimeId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialogMessages.noStartTime}</SelectItem>
                    {filteredStartTimes.map((startTime) => (
                      <SelectItem key={startTime.id} value={startTime.id}>
                        {startTime.label ?? startTime.startTimeLocal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.quantityRequiredLabel}</Label>
                <Input {...form.register("quantityRequired")} type="number" min={1} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.priorityLabel}</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.allocationModeLabel}</Label>
                <Select
                  items={allocationModeOptions}
                  value={form.watch("allocationMode")}
                  onValueChange={(value) =>
                    form.setValue(
                      "allocationMode",
                      value as ResourceAllocationRow["allocationMode"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allocationModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.resources.allocationModeLabels[option.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.save : dialogMessages.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
