import {
  type CreateFacilityInput,
  type UpdateFacilityInput,
  useFacilityMutation,
} from "@voyantjs/facilities-react"
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
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import { FACILITY_KINDS, FACILITY_STATUSES, type FacilityData } from "./facility-shared"

type FacilityKind = (typeof FACILITY_KINDS)[number]
type FacilityStatus = (typeof FACILITY_STATUSES)[number]

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  kind: z.enum(FACILITY_KINDS),
  status: z.enum(FACILITY_STATUSES),
  description: z.string().optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  facility?: FacilityData
  onSuccess: () => void
}

export function FacilityDialog({ open, onOpenChange, facility, onSuccess }: Props) {
  const isEditing = Boolean(facility)
  const { create, update } = useFacilityMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      kind: "hotel",
      status: "active",
      description: "",
      timezone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      region: "",
      country: "",
      postalCode: "",
    },
  })

  useEffect(() => {
    if (open && facility) {
      form.reset({
        name: facility.name,
        code: facility.code ?? "",
        kind: facility.kind as FacilityKind,
        status: facility.status as FacilityStatus,
        description: facility.description ?? "",
        timezone: facility.timezone ?? "",
        addressLine1: facility.addressLine1 ?? "",
        addressLine2: facility.addressLine2 ?? "",
        city: facility.city ?? "",
        region: facility.region ?? "",
        country: facility.country ?? "",
        postalCode: facility.postalCode ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        name: "",
        code: "",
        kind: "hotel",
        status: "active",
        description: "",
        timezone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        region: "",
        country: "",
        postalCode: "",
      })
    }
  }, [facility, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateFacilityInput | UpdateFacilityInput = {
      name: values.name,
      code: values.code || null,
      kind: values.kind,
      status: values.status,
      description: values.description || null,
      timezone: values.timezone || null,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      region: values.region || null,
      country: values.country || null,
      postalCode: values.postalCode || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: facility!.id, input: payload })
    } else {
      await create.mutateAsync(payload as CreateFacilityInput)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Facility" : "Add Facility"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Grand Hotel Istanbul" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="grand-istanbul" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Select
                  items={FACILITY_KINDS.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as FacilityKind)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind} className="capitalize">
                        {kind.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={FACILITY_STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as FacilityStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Short description..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Timezone</Label>
                <Input {...form.register("timezone")} placeholder="Europe/Istanbul" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Country</Label>
                <CountryCombobox
                  value={form.watch("country") ?? null}
                  onChange={(code) => form.setValue("country", code)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Address line 1</Label>
              <Input {...form.register("addressLine1")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Address line 2</Label>
              <Input {...form.register("addressLine2")} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>City</Label>
                <Input {...form.register("city")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Region</Label>
                <Input {...form.register("region")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Postal code</Label>
                <Input {...form.register("postalCode")} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Facility"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
