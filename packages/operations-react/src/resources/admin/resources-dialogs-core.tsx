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
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  type ResourcePoolRow,
  type ResourceRow,
  resourceKindOptions,
  type SupplierOption,
  useVoyantResourcesContext,
} from "../index.js"

import { sendResourcesMutation } from "./resources-admin-api.js"

const getResourceFormSchema = (messages: ReturnType<typeof useOperatorAdminMessages>) =>
  z.object({
    supplierId: z.string().optional(),
    kind: z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"]),
    name: z.string().min(1, messages.resources.dialogs.resource.validationNameRequired),
    code: z.string().optional(),
    capacity: z.string().optional(),
    active: z.boolean(),
    notes: z.string().optional(),
  })

export function ResourceDialog({
  open,
  onOpenChange,
  resource,
  suppliers,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource?: ResourceRow
  suppliers: SupplierOption[]
  onSuccess: () => void
}) {
  const client = useVoyantResourcesContext()
  const messages = useOperatorAdminMessages()
  const dialogMessages = messages.resources.dialogs.resource
  const resourceFormSchema = getResourceFormSchema(messages)
  const form = useForm({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      supplierId: NONE_VALUE,
      kind: "guide" as const,
      name: "",
      code: "",
      capacity: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && resource) {
      form.reset({
        supplierId: resource.supplierId ?? NONE_VALUE,
        kind: resource.kind,
        name: resource.name,
        code: resource.code ?? "",
        capacity: resource.capacity?.toString() ?? "",
        active: resource.active,
        notes: resource.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, resource])

  const isEditing = Boolean(resource)

  const onSubmit = async (values: z.output<typeof resourceFormSchema>) => {
    const payload = {
      supplierId: values.supplierId === NONE_VALUE ? null : values.supplierId,
      kind: values.kind,
      name: values.name,
      code: nullableString(values.code),
      capacity: nullableNumber(values.capacity),
      active: values.active,
      notes: nullableString(values.notes),
    }

    if (isEditing) {
      await sendResourcesMutation(
        client,
        "PATCH",
        `/v1/admin/operations/resources/${resource?.id}`,
        payload,
      )
    } else {
      await sendResourcesMutation(client, "POST", "/v1/admin/operations/resources", payload)
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
              <Label>{dialogMessages.supplierLabel}</Label>
              <Select
                value={form.watch("supplierId")}
                onValueChange={(value) => form.setValue("supplierId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{dialogMessages.noSupplier}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.kindLabel}</Label>
                <Select
                  items={resourceKindOptions}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as ResourceRow["kind"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceKindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.resources.kindLabels[option.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.nameLabel}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.namePlaceholder} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.codeLabel}</Label>
                <Input {...form.register("code")} placeholder={dialogMessages.codePlaceholder} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.capacityLabel}</Label>
                <Input {...form.register("capacity")} type="number" min={0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={dialogMessages.notesPlaceholder} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{dialogMessages.activeTitle}</p>
                <p className="text-xs text-muted-foreground">{dialogMessages.activeDescription}</p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
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

const getPoolFormSchema = (messages: ReturnType<typeof useOperatorAdminMessages>) =>
  z.object({
    productId: z.string().optional(),
    kind: z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"]),
    name: z.string().min(1, messages.resources.dialogs.pool.validationNameRequired),
    sharedCapacity: z.string().optional(),
    active: z.boolean(),
    notes: z.string().optional(),
  })

export function ResourcePoolDialog({
  open,
  onOpenChange,
  pool,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pool?: ResourcePoolRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const client = useVoyantResourcesContext()
  const messages = useOperatorAdminMessages()
  const dialogMessages = messages.resources.dialogs.pool
  const poolFormSchema = getPoolFormSchema(messages)
  const form = useForm({
    resolver: zodResolver(poolFormSchema),
    defaultValues: {
      productId: NONE_VALUE,
      kind: "guide" as const,
      name: "",
      sharedCapacity: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && pool) {
      form.reset({
        productId: pool.productId ?? NONE_VALUE,
        kind: pool.kind,
        name: pool.name,
        sharedCapacity: pool.sharedCapacity?.toString() ?? "",
        active: pool.active,
        notes: pool.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, pool])

  const isEditing = Boolean(pool)

  const onSubmit = async (values: z.output<typeof poolFormSchema>) => {
    const payload = {
      productId: values.productId === NONE_VALUE ? null : values.productId,
      kind: values.kind,
      name: values.name,
      sharedCapacity: nullableNumber(values.sharedCapacity),
      active: values.active,
      notes: nullableString(values.notes),
    }

    if (isEditing) {
      await sendResourcesMutation(
        client,
        "PATCH",
        `/v1/admin/operations/pools/${pool?.id}`,
        payload,
      )
    } else {
      await sendResourcesMutation(client, "POST", "/v1/admin/operations/pools", payload)
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
              <Label>{dialogMessages.productLabel}</Label>
              <Select
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{dialogMessages.noProduct}</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.kindLabel}</Label>
                <Select
                  items={resourceKindOptions}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as ResourcePoolRow["kind"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceKindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.resources.kindLabels[option.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.nameLabel}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.namePlaceholder} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.sharedCapacityLabel}</Label>
                <Input {...form.register("sharedCapacity")} type="number" min={0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={dialogMessages.notesPlaceholder} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{dialogMessages.activeTitle}</p>
                <p className="text-xs text-muted-foreground">{dialogMessages.activeDescription}</p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
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
