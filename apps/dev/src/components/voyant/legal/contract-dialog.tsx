import { type LegalContractRecord, useLegalContractMutation } from "@voyantjs/legal-react"
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
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"

const contractFormSchema = z.object({
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  title: z.string().min(1, "Title is required"),
  language: z.string().min(2).max(10).optional(),
  templateVersionId: z.string().optional(),
  seriesId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  supplierId: z.string().optional(),
  channelId: z.string().optional(),
  expiresAt: z.string().optional(),
  variables: z.string().optional(),
  metadata: z.string().optional(),
})

type FormValues = z.input<typeof contractFormSchema>
type FormOutput = z.output<typeof contractFormSchema>

type ContractDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: LegalContractRecord
  onSuccess: () => void
}

type PersonRef = {
  id: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}
type OrganizationRef = {
  id: string
  name: string
  website?: string | null
  industry?: string | null
}
type SupplierRef = { id: string; name: string; city?: string | null; country?: string | null }
type ChannelRef = { id: string; name: string; kind?: string | null; status?: string | null }

const SCOPES = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "channel", label: "Channel" },
  { value: "other", label: "Other" },
] as const

function personLabel(person: PersonRef) {
  if (person.displayName) return person.displayName
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ")
  return fullName || person.email || person.id
}

export function ContractDialog({ open, onOpenChange, contract, onSuccess }: ContractDialogProps) {
  const isEditing = !!contract
  const { create, update } = useLegalContractMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      scope: "customer",
      title: "",
      language: "en",
      templateVersionId: "",
      seriesId: "",
      personId: "",
      organizationId: "",
      supplierId: "",
      channelId: "",
      expiresAt: "",
      variables: "",
      metadata: "",
    },
  })

  useEffect(() => {
    if (open && contract) {
      form.reset({
        scope: contract.scope,
        title: contract.title,
        language: contract.language ?? "en",
        templateVersionId: contract.templateVersionId ?? "",
        seriesId: contract.seriesId ?? "",
        personId: contract.personId ?? "",
        organizationId: contract.organizationId ?? "",
        supplierId: contract.supplierId ?? "",
        channelId: contract.channelId ?? "",
        expiresAt: contract.expiresAt ?? "",
        variables: contract.variables ? JSON.stringify(contract.variables, null, 2) : "",
        metadata: contract.metadata ? JSON.stringify(contract.metadata, null, 2) : "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, contract, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      scope: values.scope,
      title: values.title,
      language: values.language || "en",
      templateVersionId: values.templateVersionId || undefined,
      seriesId: values.seriesId || undefined,
      personId: values.personId || undefined,
      organizationId: values.organizationId || undefined,
      supplierId: values.supplierId || undefined,
      channelId: values.channelId || undefined,
      expiresAt: values.expiresAt || undefined,
      variables: values.variables ? JSON.parse(values.variables) : undefined,
      metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
    }

    if (isEditing && contract) {
      await update.mutateAsync({ id: contract.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const setReferenceField = (
    field: "personId" | "organizationId" | "supplierId" | "channelId",
    value: string | null,
  ) => {
    form.setValue(field, value ?? "", { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Contract" : "New Contract"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={SCOPES}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Language</Label>
                <Input {...form.register("language")} placeholder="en" maxLength={10} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="Contract title" />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Template Version ID</Label>
                <Input {...form.register("templateVersionId")} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Series ID</Label>
                <Input {...form.register("seriesId")} placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Person</Label>
                <EntityCombobox<PersonRef>
                  value={form.watch("personId") || null}
                  onChange={(id) => setReferenceField("personId", id)}
                  endpoint="/v1/crm/people"
                  detailEndpoint="/v1/crm/people/:id"
                  queryKey={["legal", "contracts", "people"]}
                  getLabel={personLabel}
                  getSecondary={(person) => person.email ?? undefined}
                  placeholder="Search people"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Organization</Label>
                <EntityCombobox<OrganizationRef>
                  value={form.watch("organizationId") || null}
                  onChange={(id) => setReferenceField("organizationId", id)}
                  endpoint="/v1/crm/organizations"
                  detailEndpoint="/v1/crm/organizations/:id"
                  queryKey={["legal", "contracts", "organizations"]}
                  getLabel={(organization) => organization.name}
                  getSecondary={(organization) =>
                    [organization.website, organization.industry].filter(Boolean).join(" / ") ||
                    undefined
                  }
                  placeholder="Search organizations"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Supplier</Label>
                <EntityCombobox<SupplierRef>
                  value={form.watch("supplierId") || null}
                  onChange={(id) => setReferenceField("supplierId", id)}
                  endpoint="/v1/suppliers"
                  detailEndpoint="/v1/suppliers/:id"
                  queryKey={["legal", "contracts", "suppliers"]}
                  getLabel={(supplier) => supplier.name}
                  getSecondary={(supplier) =>
                    [supplier.city, supplier.country].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder="Search suppliers"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Channel</Label>
                <EntityCombobox<ChannelRef>
                  value={form.watch("channelId") || null}
                  onChange={(id) => setReferenceField("channelId", id)}
                  endpoint="/v1/distribution/channels"
                  detailEndpoint="/v1/distribution/channels/:id"
                  queryKey={["legal", "contracts", "channels"]}
                  getLabel={(channel) => channel.name}
                  getSecondary={(channel) =>
                    [channel.kind, channel.status].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder="Search channels"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Expires At</Label>
              <DateTimePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select expiry date & time"
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Variables (JSON)</Label>
              <Textarea {...form.register("variables")} placeholder='{"key": "value"}' rows={3} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Metadata (JSON)</Label>
              <Textarea {...form.register("metadata")} placeholder='{"key": "value"}' rows={3} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
