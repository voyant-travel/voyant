import {
  SERVICE_TYPES,
  type SupplierService,
  useSupplierServiceMutation,
} from "@voyantjs/suppliers-react"
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
import { zodResolver } from "@/lib/zod-resolver"

const serviceFormSchema = z.object({
  serviceType: z.enum(["accommodation", "transfer", "experience", "guide", "meal", "other"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
  active: z.boolean().default(true),
})

type ServiceFormValues = z.input<typeof serviceFormSchema>
type ServiceFormOutput = z.output<typeof serviceFormSchema>

export type ServiceData = SupplierService

export type ServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  service?: ServiceData
  onSuccess: () => void
}

export function ServiceDialog({
  open,
  onOpenChange,
  supplierId,
  service,
  onSuccess,
}: ServiceDialogProps) {
  const isEditing = !!service
  const serviceMutation = useSupplierServiceMutation(supplierId)

  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      serviceType: "accommodation",
      name: "",
      description: "",
      duration: "",
      capacity: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && service) {
      form.reset({
        serviceType: service.serviceType,
        name: service.name,
        description: service.description ?? "",
        duration: service.duration ?? "",
        capacity: service.capacity ?? "",
        active: service.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, service, form])

  const onSubmit = async (values: ServiceFormOutput) => {
    const payload = {
      serviceType: values.serviceType,
      name: values.name,
      description: values.description || null,
      duration: values.duration || null,
      capacity: values.capacity && typeof values.capacity === "number" ? values.capacity : null,
      active: values.active,
    }

    if (isEditing) {
      await serviceMutation.update.mutateAsync({ serviceId: service.id, input: payload })
    } else {
      await serviceMutation.create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
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

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Service description..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Duration</Label>
                <Input {...form.register("duration")} placeholder="3 hours, per night, etc." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Capacity (max pax)</Label>
                <Input {...form.register("capacity")} type="number" placeholder="10" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(v) => form.setValue("active", v)}
              />
              <Label>Active</Label>
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
