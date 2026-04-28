import { useQuery } from "@tanstack/react-query"
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
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const serviceFormSchema = z.object({
  serviceType: z.enum(["accommodation", "transfer", "experience", "guide", "meal", "other"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  supplierServiceId: z.string().optional().nullable(),
  costCurrency: z.string().min(3).max(3, "Use 3-letter ISO code"),
  costAmount: z.coerce.number().min(0, "Cost must be non-negative"),
  quantity: z.coerce.number().int().positive().default(1),
  sortOrder: z.coerce.number().int().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
})

type ServiceFormValues = z.input<typeof serviceFormSchema>
type ServiceFormOutput = z.output<typeof serviceFormSchema>

type DayServiceData = {
  id: string
  serviceType: "accommodation" | "transfer" | "experience" | "guide" | "meal" | "other"
  name: string
  description: string | null
  supplierServiceId: string | null
  costCurrency: string
  costAmountCents: number
  quantity: number
  sortOrder: number | null
  notes: string | null
}

type SupplierServiceOption = {
  id: string
  supplierId: string
  supplierName: string
  serviceType: string
  name: string
}

type ServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId: string
  service?: DayServiceData
  onSuccess: () => void
}

const SERVICE_TYPES = [
  { value: "accommodation", label: "Accommodation" },
  { value: "transfer", label: "Transfer" },
  { value: "experience", label: "Experience" },
  { value: "guide", label: "Guide" },
  { value: "meal", label: "Meal" },
  { value: "other", label: "Other" },
] as const

export function ServiceDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  service,
  onSuccess,
}: ServiceDialogProps) {
  const isEditing = !!service

  // Fetch suppliers + their services for the picker
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-for-picker"],
    queryFn: async () => {
      const res = await api.get<{
        data: Array<{ id: string; name: string }>
        total: number
      }>("/v1/suppliers?limit=100")
      const options: SupplierServiceOption[] = []
      for (const supplier of res.data) {
        const servicesRes = await api.get<{
          data: Array<{ id: string; serviceType: string; name: string }>
        }>(`/v1/suppliers/${supplier.id}/services`)
        for (const svc of servicesRes.data) {
          options.push({
            id: svc.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            serviceType: svc.serviceType,
            name: svc.name,
          })
        }
      }
      return options
    },
    enabled: open,
  })

  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      serviceType: "accommodation",
      name: "",
      description: "",
      supplierServiceId: "",
      costCurrency: "EUR",
      costAmount: 0,
      quantity: 1,
      sortOrder: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && service) {
      form.reset({
        serviceType: service.serviceType,
        name: service.name,
        description: service.description ?? "",
        supplierServiceId: service.supplierServiceId ?? "",
        costCurrency: service.costCurrency,
        costAmount: service.costAmountCents / 100,
        quantity: service.quantity,
        sortOrder: service.sortOrder ?? "",
        notes: service.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, service, form])

  const handleSupplierServiceSelect = (supplierServiceId: string | null) => {
    const nextSupplierServiceId = supplierServiceId ?? ""
    form.setValue("supplierServiceId", nextSupplierServiceId)
    const option = suppliersData?.find((o) => o.id === nextSupplierServiceId)
    if (option) {
      form.setValue("name", option.name)
      form.setValue("serviceType", option.serviceType as ServiceFormValues["serviceType"])
    }
  }

  const onSubmit = async (values: ServiceFormOutput) => {
    const payload = {
      serviceType: values.serviceType,
      name: values.name,
      description: values.description || null,
      supplierServiceId: values.supplierServiceId || null,
      costCurrency: values.costCurrency,
      costAmountCents: Math.round(values.costAmount * 100),
      quantity: values.quantity,
      sortOrder: values.sortOrder && typeof values.sortOrder === "number" ? values.sortOrder : null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await api.patch(`/v1/products/${productId}/days/${dayId}/services/${service.id}`, payload)
    } else {
      await api.post(`/v1/products/${productId}/days/${dayId}/services`, payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            {/* Supplier service picker */}
            {suppliersData && suppliersData.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Link Supplier Service (optional)</Label>
                <Select
                  items={suppliersData.map((opt) => ({
                    label: `${opt.supplierName} — ${opt.name} (${opt.serviceType})`,
                    value: opt.id,
                  }))}
                  value={form.watch("supplierServiceId") ?? ""}
                  onValueChange={handleSupplierServiceSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a supplier service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersData.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.supplierName} — {opt.name} ({opt.serviceType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Service Type</Label>
                <Select
                  items={SERVICE_TYPES}
                  value={form.watch("serviceType")}
                  onValueChange={(v) =>
                    form.setValue("serviceType", v as ServiceFormValues["serviceType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Deluxe Sea View Room" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Service details..." />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Cost Currency</Label>
                <Input
                  {...form.register("costCurrency")}
                  placeholder="EUR"
                  maxLength={3}
                  className="uppercase"
                />
                {form.formState.errors.costCurrency && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.costCurrency.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cost Amount</Label>
                <Input
                  {...form.register("costAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="150.00"
                />
                {form.formState.errors.costAmount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.costAmount.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Quantity</Label>
                <Input {...form.register("quantity")} type="number" min="1" placeholder="1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sort Order</Label>
                <Input {...form.register("sortOrder")} type="number" placeholder="1" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Additional notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
