import type {
  ChannelContractRow,
  ChannelRow,
  SupplierOption,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  cancellationOwnerOptions,
  channelKindOptions,
  channelStatusOptions,
  contractStatusOptions,
  NONE_VALUE,
  nullableString,
  parseJsonRecord,
  paymentOwnerOptions,
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
  Textarea,
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const channelFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  kind: z.enum(["direct", "affiliate", "ota", "reseller", "marketplace", "api_partner", "connect"]),
  status: z.enum(["active", "inactive", "pending", "archived"]),
  website: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  metadataJson: z.string().optional(),
})

export function ChannelDialog({
  open,
  onOpenChange,
  channel,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: ChannelRow
  onSuccess: () => void
}) {
  const form = useForm({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      kind: "direct" as const,
      status: "active" as const,
      website: "",
      contactName: "",
      contactEmail: "",
      metadataJson: "",
    },
  })

  useEffect(() => {
    if (open && channel) {
      form.reset({
        name: channel.name,
        kind: channel.kind,
        status: channel.status,
        website: channel.website ?? "",
        contactName: channel.contactName ?? "",
        contactEmail: channel.contactEmail ?? "",
        metadataJson: channel.metadata ? JSON.stringify(channel.metadata, null, 2) : "",
      })
    } else if (open) {
      form.reset()
    }
  }, [channel, form, open])

  const isEditing = Boolean(channel)

  const onSubmit = async (values: z.output<typeof channelFormSchema>) => {
    const payload = {
      name: values.name,
      kind: values.kind,
      status: values.status,
      website: nullableString(values.website),
      contactName: nullableString(values.contactName),
      contactEmail: nullableString(values.contactEmail),
      metadata: parseJsonRecord(values.metadataJson),
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/channels/${channel?.id}`, payload)
    } else {
      await api.post("/v1/distribution/channels", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Channel" : "New Channel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="GetYourGuide" />
              </div>
              <div className="grid gap-2">
                <Label>Kind</Label>
                <Select
                  items={channelKindOptions}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as ChannelRow["kind"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channelKindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  items={channelStatusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as ChannelRow["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channelStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input {...form.register("website")} placeholder="https://partner.example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Contact Name</Label>
                <Input {...form.register("contactName")} placeholder="Partnerships Team" />
              </div>
              <div className="grid gap-2">
                <Label>Contact Email</Label>
                <Input
                  {...form.register("contactEmail")}
                  type="email"
                  placeholder="partners@example.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Metadata JSON</Label>
              <Textarea
                {...form.register("metadataJson")}
                placeholder='{"region":"EU","accountTier":"gold"}'
                className="min-h-32 font-mono text-xs"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Channel" : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const contractFormSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  supplierId: z.string().optional(),
  status: z.enum(["draft", "active", "expired", "terminated"]),
  startsAt: z.string().min(1, "Start date is required"),
  endsAt: z.string().optional(),
  paymentOwner: z.enum(["operator", "channel", "split"]),
  cancellationOwner: z.enum(["operator", "channel", "mixed"]),
  settlementTerms: z.string().optional(),
  notes: z.string().optional(),
})

export function ChannelContractDialog({
  open,
  onOpenChange,
  contract,
  channels,
  suppliers,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: ChannelContractRow
  channels: ChannelRow[]
  suppliers: SupplierOption[]
  onSuccess: () => void
}) {
  const form = useForm({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      channelId: "",
      supplierId: NONE_VALUE,
      status: "draft" as const,
      startsAt: "",
      endsAt: "",
      paymentOwner: "operator" as const,
      cancellationOwner: "operator" as const,
      settlementTerms: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && contract) {
      form.reset({
        channelId: contract.channelId,
        supplierId: contract.supplierId ?? NONE_VALUE,
        status: contract.status,
        startsAt: contract.startsAt,
        endsAt: contract.endsAt ?? "",
        paymentOwner: contract.paymentOwner,
        cancellationOwner: contract.cancellationOwner,
        settlementTerms: contract.settlementTerms ?? "",
        notes: contract.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [contract, form, open])

  const isEditing = Boolean(contract)

  const onSubmit = async (values: z.output<typeof contractFormSchema>) => {
    const payload = {
      channelId: values.channelId,
      supplierId: values.supplierId === NONE_VALUE ? null : values.supplierId,
      status: values.status,
      startsAt: values.startsAt,
      endsAt: nullableString(values.endsAt),
      paymentOwner: values.paymentOwner,
      cancellationOwner: values.cancellationOwner,
      settlementTerms: nullableString(values.settlementTerms),
      notes: nullableString(values.notes),
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/contracts/${contract?.id}`, payload)
    } else {
      await api.post("/v1/distribution/contracts", payload)
    }
    onSuccess()
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
              <div className="grid gap-2">
                <Label>Channel</Label>
                <Select
                  items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                  value={form.watch("channelId")}
                  onValueChange={(value) => form.setValue("channelId", value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  items={contractStatusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ChannelContractRow["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contractStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Starts At</Label>
                <DatePicker
                  value={form.watch("startsAt") || null}
                  onChange={(next) =>
                    form.setValue("startsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ends At</Label>
                <DatePicker
                  value={form.watch("endsAt") || null}
                  onChange={(next) =>
                    form.setValue("endsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select end date"
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Payment Owner</Label>
                <Select
                  items={paymentOwnerOptions}
                  value={form.watch("paymentOwner")}
                  onValueChange={(value) =>
                    form.setValue("paymentOwner", value as ChannelContractRow["paymentOwner"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentOwnerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cancellation Owner</Label>
                <Select
                  items={cancellationOwnerOptions}
                  value={form.watch("cancellationOwner")}
                  onValueChange={(value) =>
                    form.setValue(
                      "cancellationOwner",
                      value as ChannelContractRow["cancellationOwner"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cancellationOwnerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Settlement Terms</Label>
              <Textarea
                {...form.register("settlementTerms")}
                placeholder="Monthly payout, 45-day remittance, chargeback treatment..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Special commercial constraints or operational clauses..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Contract" : "Create Contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
