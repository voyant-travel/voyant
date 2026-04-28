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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import type {
  ProductOption,
  ResourcePoolRow,
  ResourceRow,
  SupplierOption,
} from "./resources-shared"
import { NONE_VALUE, nullableNumber, nullableString, resourceKindOptions } from "./resources-shared"

const resourceFormSchema = z.object({
  supplierId: z.string().optional(),
  kind: z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"]),
  name: z.string().min(1, "Name is required"),
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
      await api.patch(`/v1/resources/resources/${resource?.id}`, payload)
    } else {
      await api.post("/v1/resources/resources", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Resource" : "New Resource"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select
                items={[
                  { label: "No supplier", value: NONE_VALUE },
                  ...suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id })),
                ]}
                value={form.watch("supplierId")}
                onValueChange={(value) => form.setValue("supplierId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No supplier</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Kind</Label>
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
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Guide Anna" />
              </div>
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="G-001" />
              </div>
              <div className="grid gap-2">
                <Label>Capacity</Label>
                <Input {...form.register("capacity")} type="number" min={0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Languages, certifications, maintenance notes..."
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Make this resource available for assignment.
                </p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Resource" : "Create Resource"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const poolFormSchema = z.object({
  productId: z.string().optional(),
  kind: z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"]),
  name: z.string().min(1, "Name is required"),
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
      await api.patch(`/v1/resources/pools/${pool?.id}`, payload)
    } else {
      await api.post("/v1/resources/pools", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Pool" : "New Pool"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                items={[
                  { label: "No product", value: NONE_VALUE },
                  ...products.map((product) => ({ label: product.name, value: product.id })),
                ]}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No product</SelectItem>
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
                <Label>Kind</Label>
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
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Morning guide pool" />
              </div>
              <div className="grid gap-2">
                <Label>Shared Capacity</Label>
                <Input {...form.register("sharedCapacity")} type="number" min={0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Shared allocation assumptions or operating rules..."
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Allow new allocations against this pool.
                </p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Pool" : "Create Pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
