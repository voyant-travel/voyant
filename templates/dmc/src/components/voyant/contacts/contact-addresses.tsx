"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { Label } from "@voyantjs/ui/components/label"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Loader2, MapPin, Pencil, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  ADDRESS_LABELS,
  type AddressLabel,
  type ContactAddress,
  type ContactAddressUpsertInput,
} from "./contact-shared"

type AddressFormState = {
  label: AddressLabel
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string | null
  isPrimary: boolean
  notes: string
}

function emptyAddressFormState(): AddressFormState {
  return {
    label: "primary",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: null,
    isPrimary: false,
    notes: "",
  }
}

function addressFormStateFromRecord(address?: ContactAddress): AddressFormState {
  if (!address) return emptyAddressFormState()
  return {
    label: address.label,
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? null,
    isPrimary: address.isPrimary,
    notes: address.notes ?? "",
  }
}

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function formatAddressText(
  address: Pick<
    ContactAddress,
    "fullText" | "line1" | "line2" | "city" | "region" | "postalCode" | "country"
  >,
): string | null {
  if (address.fullText?.trim()) return address.fullText.trim()

  const locality = [address.city, address.region, address.postalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")

  const parts = [address.line1, address.line2, locality || null, address.country]
    .map((part) => part?.trim())
    .filter(Boolean)

  return parts.length > 0 ? parts.join(", ") : null
}

function addressLabelText(
  label: AddressLabel,
  messages: ReturnType<typeof useAdminMessages>["contacts"]["detail"],
): string {
  switch (label) {
    case "primary":
      return messages.addressTypePrimary
    case "billing":
      return messages.addressTypeBilling
    case "shipping":
      return messages.addressTypeShipping
    case "mailing":
      return messages.addressTypeMailing
    case "meeting":
      return messages.addressTypeMeeting
    case "service":
      return messages.addressTypeService
    case "legal":
      return messages.addressTypeLegal
    case "other":
      return messages.addressTypeOther
    default:
      return label
  }
}

function ContactAddressDialog({
  open,
  onOpenChange,
  address,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  address?: ContactAddress
  pending: boolean
  onSubmit: (input: ContactAddressUpsertInput) => Promise<void>
}) {
  const messages = useAdminMessages().contacts.detail
  const formMessages = useAdminMessages().contacts.form
  const isEditing = Boolean(address)
  const [form, setForm] = useState<AddressFormState>(emptyAddressFormState())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(addressFormStateFromRecord(address))
    setError(null)
  }, [address, open])

  const updateField = <K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async () => {
    const payload: ContactAddressUpsertInput = {
      label: form.label,
      line1: normalizeNullable(form.line1),
      line2: normalizeNullable(form.line2),
      city: normalizeNullable(form.city),
      region: normalizeNullable(form.region),
      postalCode: normalizeNullable(form.postalCode),
      country: form.country?.trim() ? form.country.trim().toUpperCase() : null,
      isPrimary: form.isPrimary,
      notes: normalizeNullable(form.notes),
      fullText: null,
    }

    payload.fullText = formatAddressText(payload)

    try {
      setError(null)
      await onSubmit(payload)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.addressSaveFailed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? messages.addressDialogEditTitle : messages.addressDialogNewTitle}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? messages.addressDialogEditDescription
              : messages.addressDialogNewDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label>{messages.addressTypeLabel}</Label>
              <Select
                items={ADDRESS_LABELS.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                value={form.label}
                onValueChange={(value) => updateField("label", value as AddressLabel)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>
                      {addressLabelText(label, messages)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 sm:pb-2">
              <Switch
                checked={form.isPrimary}
                onCheckedChange={(checked) => updateField("isPrimary", checked)}
              />
              <Label>{messages.addressPrimaryToggle}</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{messages.addressLine1Label}</Label>
              <Input
                value={form.line1}
                onChange={(event) => updateField("line1", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{messages.addressLine2Label}</Label>
              <Input
                value={form.line2}
                onChange={(event) => updateField("line2", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{messages.cityLabel}</Label>
              <Input
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{messages.regionLabel}</Label>
              <Input
                value={form.region}
                onChange={(event) => updateField("region", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{messages.postalCodeLabel}</Label>
              <Input
                value={form.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{messages.countryLabel}</Label>
            <CountryCombobox
              value={form.country}
              onChange={(code) => updateField("country", code)}
            />
          </div>

          <div className="space-y-2">
            <Label>{messages.addressNotesLabel}</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="min-h-[90px]"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {formMessages.cancel}
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? messages.editAddressAction : messages.addAddressAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContactAddressesSection({
  addresses,
  pending,
  creating,
  updatingAddressId,
  deletingAddressId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  addresses: ContactAddress[]
  pending: boolean
  creating: boolean
  updatingAddressId?: string
  deletingAddressId?: string
  onCreate: (input: ContactAddressUpsertInput) => Promise<void>
  onUpdate: (addressId: string, input: ContactAddressUpsertInput) => Promise<void>
  onDelete: (addressId: string) => Promise<void>
}) {
  const messages = useAdminMessages().contacts.detail
  const [createOpen, setCreateOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ContactAddress | undefined>(undefined)

  const sortedAddresses = useMemo(
    () =>
      [...addresses].sort((left, right) => {
        if (left.isPrimary === right.isPrimary) {
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        }
        return left.isPrimary ? -1 : 1
      }),
    [addresses],
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{messages.addressesTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{messages.addressesDescription}</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {messages.addAddressAction}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : sortedAddresses.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {messages.noAddressesYet}
            </div>
          ) : (
            sortedAddresses.map((address) => {
              const formatted = formatAddressText(address)
              return (
                <div key={address.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{addressLabelText(address.label, messages)}</Badge>
                        {address.isPrimary ? (
                          <Badge variant="secondary">{messages.addressPrimaryToggle}</Badge>
                        ) : null}
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="space-y-1">
                          <p>{formatted ?? messages.noAddressValue}</p>
                          {address.notes ? (
                            <p className="text-muted-foreground">{address.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAddress(address)}
                        disabled={creating || updatingAddressId === address.id}
                      >
                        {updatingAddressId === address.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Pencil className="mr-2 h-4 w-4" />
                        )}
                        {messages.editAddressAction}
                      </Button>
                      <ConfirmActionButton
                        buttonLabel={messages.delete}
                        confirmLabel={messages.delete}
                        title={messages.addressDeleteTitle}
                        description={messages.addressDeleteDescription}
                        variant="outline"
                        confirmVariant="destructive"
                        disabled={deletingAddressId === address.id}
                        onConfirm={() => onDelete(address.id)}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <ContactAddressDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pending={creating}
        onSubmit={onCreate}
      />

      <ContactAddressDialog
        open={Boolean(editingAddress)}
        onOpenChange={(open) => {
          if (!open) setEditingAddress(undefined)
        }}
        address={editingAddress}
        pending={Boolean(editingAddress && updatingAddressId === editingAddress.id)}
        onSubmit={async (input) => {
          if (!editingAddress) return
          await onUpdate(editingAddress.id, input)
        }}
      />
    </>
  )
}
