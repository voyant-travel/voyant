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
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

function createChannelFormSchema(nameRequired: string) {
  return z.object({
    name: z.string().min(1, nameRequired),
    kind: z.enum([
      "direct",
      "affiliate",
      "ota",
      "reseller",
      "marketplace",
      "api_partner",
      "connect",
    ]),
    status: z.enum(["active", "inactive", "pending", "archived"]),
    website: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    metadataJson: z.string().optional(),
  })
}

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
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.channel
  const channelFormSchema = useMemo(
    () => createChannelFormSchema(dialogMessages.validation.nameRequired),
    [dialogMessages.validation.nameRequired],
  )
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
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.kind}</Label>
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
                        {messages.distribution.values.channelKind[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.status}</Label>
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
                        {messages.distribution.values.channelStatus[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.website}</Label>
                <Input
                  {...form.register("website")}
                  placeholder={dialogMessages.placeholders.website}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.contactName}</Label>
                <Input
                  {...form.register("contactName")}
                  placeholder={dialogMessages.placeholders.contactName}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.contactEmail}</Label>
                <Input
                  {...form.register("contactEmail")}
                  type="email"
                  placeholder={dialogMessages.placeholders.contactEmail}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.metadataJson}</Label>
              <Textarea
                {...form.register("metadataJson")}
                placeholder={dialogMessages.placeholders.metadataJson}
                className="min-h-32 font-mono text-xs"
              />
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

function createContractFormSchema(channelRequired: string, startDateRequired: string) {
  return z.object({
    channelId: z.string().min(1, channelRequired),
    supplierId: z.string().optional(),
    status: z.enum(["draft", "active", "expired", "terminated"]),
    startsAt: z.string().min(1, startDateRequired),
    endsAt: z.string().optional(),
    paymentOwner: z.enum(["operator", "channel", "split"]),
    cancellationOwner: z.enum(["operator", "channel", "mixed"]),
    settlementTerms: z.string().optional(),
    notes: z.string().optional(),
  })
}

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
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.contract
  const contractFormSchema = useMemo(
    () =>
      createContractFormSchema(
        dialogMessages.validation.channelRequired,
        dialogMessages.validation.startDateRequired,
      ),
    [dialogMessages.validation.channelRequired, dialogMessages.validation.startDateRequired],
  )
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
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.channel}</Label>
                <Select
                  items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                  value={form.watch("channelId")}
                  onValueChange={(value) => form.setValue("channelId", value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={dialogMessages.placeholders.selectChannel} />
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
                <Label>{dialogMessages.labels.supplier}</Label>
                <Select
                  value={form.watch("supplierId")}
                  onValueChange={(value) => form.setValue("supplierId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      {dialogMessages.placeholders.noSupplier}
                    </SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.status}</Label>
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
                        {messages.distribution.values.contractStatus[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.startsAt}</Label>
                <DatePicker
                  value={form.watch("startsAt") || null}
                  onChange={(next) =>
                    form.setValue("startsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.startDate}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.endsAt}</Label>
                <DatePicker
                  value={form.watch("endsAt") || null}
                  onChange={(next) =>
                    form.setValue("endsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.endDate}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.paymentOwner}</Label>
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
                        {messages.distribution.values.paymentOwner[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.cancellationOwner}</Label>
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
                        {messages.distribution.values.cancellationOwner[option.value] ??
                          option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.settlementTerms}</Label>
              <Textarea
                {...form.register("settlementTerms")}
                placeholder={dialogMessages.placeholders.settlementTerms}
              />
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={dialogMessages.placeholders.notes}
              />
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
