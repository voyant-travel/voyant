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
  Textarea,
} from "@/components/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import { useDistributionUiMessagesOrDefault } from "../../../distribution-ui/src/index"
import type { ChannelContractRow, ChannelRow, SupplierOption } from "./distribution-shared"
import {
  cancellationOwnerOptions,
  channelKindOptions,
  channelStatusOptions,
  contractStatusOptions,
  NONE_VALUE,
  nullableString,
  parseJsonRecord,
  paymentOwnerOptions,
} from "./distribution-shared"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

function getChannelFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    name: z.string().min(1, messages.dialogs.channel.validation.nameRequired),
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
  const distributionMessages = useDistributionUiMessagesOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.channel
  const kindOptions = channelKindOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.channelKindLabels[option.value],
  }))
  const statusOptions = channelStatusOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.channelStatusLabels[option.value],
  }))
  const form = useForm({
    resolver: zodResolver(getChannelFormSchema(messages)),
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

  const onSubmit = async (values: z.output<ReturnType<typeof getChannelFormSchema>>) => {
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialog.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialog.placeholders.name} />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.kind}</Label>
                <Select
                  items={kindOptions}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as ChannelRow["kind"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.status}</Label>
                <Select
                  items={statusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as ChannelRow["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.website}</Label>
                <Input {...form.register("website")} placeholder={dialog.placeholders.website} />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.contactName}</Label>
                <Input
                  {...form.register("contactName")}
                  placeholder={dialog.placeholders.contactName}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.contactEmail}</Label>
                <Input
                  {...form.register("contactEmail")}
                  type="email"
                  placeholder={dialog.placeholders.contactEmail}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialog.fields.metadataJson}</Label>
              <Textarea
                {...form.register("metadataJson")}
                placeholder={dialog.placeholders.metadataJson}
                className="min-h-32 font-mono text-xs"
              />
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

function getContractFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    channelId: z.string().min(1, messages.dialogs.contract.validation.channelRequired),
    supplierId: z.string().optional(),
    status: z.enum(["draft", "active", "expired", "terminated"]),
    startsAt: z.string().min(1, messages.dialogs.contract.validation.startsAtRequired),
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
  const distributionMessages = useDistributionUiMessagesOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.contract
  const statusOptions = contractStatusOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.contractStatusLabels[option.value],
  }))
  const paymentOptions = paymentOwnerOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.paymentOwnerLabels[option.value],
  }))
  const cancellationOptions = cancellationOwnerOptions.map((option) => ({
    value: option.value,
    label: messages.common.cancellationOwnerLabels[option.value],
  }))
  const form = useForm({
    resolver: zodResolver(getContractFormSchema(messages)),
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

  const onSubmit = async (values: z.output<ReturnType<typeof getContractFormSchema>>) => {
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialog.fields.channel}</Label>
                <Select
                  items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                  value={form.watch("channelId")}
                  onValueChange={(value) => form.setValue("channelId", value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={dialog.placeholders.selectChannel} />
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
                <Label>{dialog.fields.supplier}</Label>
                <Select
                  items={[
                    { label: dialog.placeholders.noSupplier, value: NONE_VALUE },
                    ...suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id })),
                  ]}
                  value={form.watch("supplierId")}
                  onValueChange={(value) => form.setValue("supplierId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialog.placeholders.noSupplier}</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.status}</Label>
                <Select
                  items={statusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ChannelContractRow["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.startsAt}</Label>
                <DatePicker
                  value={form.watch("startsAt") || null}
                  onChange={(next) =>
                    form.setValue("startsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.startsAt}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.endsAt}</Label>
                <DatePicker
                  value={form.watch("endsAt") || null}
                  onChange={(next) =>
                    form.setValue("endsAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.endsAt}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.paymentOwner}</Label>
                <Select
                  items={paymentOptions}
                  value={form.watch("paymentOwner")}
                  onValueChange={(value) =>
                    form.setValue("paymentOwner", value as ChannelContractRow["paymentOwner"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.cancellationOwner}</Label>
                <Select
                  items={cancellationOptions}
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
                    {cancellationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialog.fields.settlementTerms}</Label>
              <Textarea
                {...form.register("settlementTerms")}
                placeholder={dialog.placeholders.settlementTerms}
              />
            </div>
            <div className="grid gap-2">
              <Label>{dialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} placeholder={dialog.placeholders.notes} />
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
