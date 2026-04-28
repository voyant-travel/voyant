"use client"

import { type ChannelRow, useChannelMutation, useChannels } from "@voyantjs/distribution-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
} from "@voyantjs/ui/components"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { SettingsListSkeleton } from "@/components/voyant/settings/settings-list-skeleton"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const PAGE_SIZE = 25

function getChannelFormSchema(messages: AdminMessages) {
  return z.object({
    name: z.string().min(1, messages.settings.validationNameRequired).max(255),
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
    website: z
      .string()
      .url(messages.settings.validationInvalidUrl)
      .optional()
      .nullable()
      .or(z.literal("")),
    contactName: z.string().optional().nullable(),
    contactEmail: z
      .string()
      .email(messages.settings.validationInvalidEmail)
      .optional()
      .nullable()
      .or(z.literal("")),
  })
}

type ChannelFormSchema = ReturnType<typeof getChannelFormSchema>
type ChannelFormValues = z.input<ChannelFormSchema>
type ChannelFormOutput = z.output<ChannelFormSchema>

export function ChannelsPage() {
  const messages = useAdminMessages()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ChannelRow | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useChannels({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useChannelMutation()

  const channels = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const channelKindLabels: Record<string, string> = {
    direct: messages.settings.channelsPage.kindDirect,
    affiliate: messages.settings.channelsPage.kindAffiliate,
    ota: messages.settings.channelsPage.kindOta,
    reseller: messages.settings.channelsPage.kindReseller,
    marketplace: messages.settings.channelsPage.kindMarketplace,
    api_partner: messages.settings.channelsPage.kindApiPartner,
    connect: messages.settings.channelsPage.kindConnect,
  }
  const channelStatusLabels: Record<string, string> = {
    active: messages.settings.channelsPage.statusActive,
    inactive: messages.settings.channelsPage.statusInactive,
    pending: messages.settings.channelsPage.statusPending,
    archived: messages.settings.channelsPage.statusArchived,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {messages.settings.channelsPage.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.settings.channelsPage.description}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setSheetOpen(true)
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {messages.settings.channelsPage.addChannel}
        </Button>
      </div>

      {isPending ? (
        <SettingsListSkeleton rows={5} metaLines={1} />
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          {channels.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {messages.settings.channelsPage.empty}
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between px-6 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{channel.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {channelKindLabels[channel.kind] ?? channel.kind.replace("_", " ")}
                      </Badge>
                      {channel.status !== "active" ? (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {channelStatusLabels[channel.status] ?? channel.status}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {channel.website ? <span>{channel.website}</span> : null}
                      {channel.contactName ? <span>{channel.contactName}</span> : null}
                      {channel.contactEmail ? <span>{channel.contactEmail}</span> : null}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(channel)
                          setSheetOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {messages.settings.channelsPage.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (confirm(messages.settings.channelsPage.deleteConfirm)) {
                            remove.mutate(channel.id, { onSuccess: () => void refetch() })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {messages.settings.channelsPage.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {messages.settings.paginationShowing
            .replace("{count}", String(channels.length))
            .replace("{total}", String(total))}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            {messages.settings.paginationPrevious}
          </Button>
          <span>
            {messages.settings.paginationPage
              .replace("{page}", String(pageIndex + 1))
              .replace("{pageCount}", String(pageCount))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * PAGE_SIZE >= total}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.settings.paginationNext}
          </Button>
        </div>
      </div>

      <ChannelSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        channel={editing}
        onSuccess={() => {
          setSheetOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

function ChannelSheet({
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
  const isEditing = !!channel
  const { create, update } = useChannelMutation()
  const channelKinds = [
    { value: "direct", label: messages.settings.channelsPage.kindDirect },
    { value: "affiliate", label: messages.settings.channelsPage.kindAffiliate },
    { value: "ota", label: messages.settings.channelsPage.kindOta },
    { value: "reseller", label: messages.settings.channelsPage.kindReseller },
    { value: "marketplace", label: messages.settings.channelsPage.kindMarketplace },
    { value: "api_partner", label: messages.settings.channelsPage.kindApiPartner },
    { value: "connect", label: messages.settings.channelsPage.kindConnect },
  ] as const
  const channelFormSchema = useMemo(() => getChannelFormSchema(messages), [messages])

  const form = useForm<ChannelFormValues, unknown, ChannelFormOutput>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      kind: "direct",
      status: "active",
      website: "",
      contactName: "",
      contactEmail: "",
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
      })
    } else if (open) {
      form.reset()
    }
  }, [open, channel, form])

  const isSubmitting = create.isPending || update.isPending

  const onSubmit = async (values: ChannelFormOutput) => {
    const payload = {
      name: values.name,
      kind: values.kind,
      status: values.status,
      website: values.website || null,
      contactName: values.contactName || null,
      contactEmail: values.contactEmail || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: channel.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.settings.channelsPage.editSheetTitle
              : messages.settings.channelsPage.newSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.settings.channelsPage.nameLabel}</Label>
              <Input
                {...form.register("name")}
                placeholder={messages.settings.channelsPage.namePlaceholder}
                autoFocus
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.channelsPage.kindLabel}</Label>
                <Select
                  items={channelKinds}
                  value={form.watch("kind")}
                  onValueChange={(value) =>
                    form.setValue("kind", value as ChannelFormValues["kind"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channelKinds.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.settings.channelsPage.statusLabel}</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ChannelFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      {messages.settings.channelsPage.statusActive}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {messages.settings.channelsPage.statusInactive}
                    </SelectItem>
                    <SelectItem value="pending">
                      {messages.settings.channelsPage.statusPending}
                    </SelectItem>
                    <SelectItem value="archived">
                      {messages.settings.channelsPage.statusArchived}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.settings.channelsPage.websiteLabel}</Label>
              <Input
                {...form.register("website")}
                placeholder={messages.settings.channelsPage.websitePlaceholder}
              />
              {form.formState.errors.website ? (
                <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.channelsPage.primaryContactLabel}</Label>
                <Input
                  {...form.register("contactName")}
                  placeholder={messages.settings.channelsPage.primaryContactPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.channelsPage.contactEmailLabel}</Label>
                <Input
                  {...form.register("contactEmail")}
                  placeholder={messages.settings.channelsPage.contactEmailPlaceholder}
                />
                {form.formState.errors.contactEmail ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.contactEmail.message}
                  </p>
                ) : null}
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.settings.channelsPage.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.settings.channelsPage.saveChanges
                : messages.settings.channelsPage.createChannel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
