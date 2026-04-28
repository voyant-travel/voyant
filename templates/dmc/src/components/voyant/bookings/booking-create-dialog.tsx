"use client"

import {
  type BookingRecord,
  useBookingConvertMutation,
  useBookingGroupMemberMutation,
  useBookingGroupMutation,
  useBookingGroups,
} from "@voyantjs/bookings-react"
import { useOrganizations, usePeople, usePersonMutation } from "@voyantjs/crm-react"
import { useProductOptions, useProducts } from "@voyantjs/products-react"
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
import { Loader2, UserPlus } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

function generateBookingNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BK-${y}${m}-${seq}`
}

const NONE = "__none__"

export interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (booking: BookingRecord) => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
}

type PersonMode = "existing" | "new"

export function BookingCreateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProductId,
}: BookingCreateDialogProps) {
  const messages = useAdminMessages().bookings.create
  const [productId, setProductId] = React.useState(defaultProductId ?? "")
  const [productSearch, setProductSearch] = React.useState("")
  const [optionId, setOptionId] = React.useState<string>(NONE)
  const [organizationId, setOrganizationId] = React.useState<string>(NONE)
  const [orgSearch, setOrgSearch] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const [personMode, setPersonMode] = React.useState<PersonMode>("existing")
  const [personId, setPersonId] = React.useState("")
  const [personSearch, setPersonSearch] = React.useState("")
  const [newPerson, setNewPerson] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  const [error, setError] = React.useState<string | null>(null)

  // Shared-room state
  const [sharedRoomEnabled, setSharedRoomEnabled] = React.useState(false)
  const [sharedRoomMode, setSharedRoomMode] = React.useState<"create" | "join">("create")
  const [sharedRoomGroupId, setSharedRoomGroupId] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setProductId(defaultProductId ?? "")
      setProductSearch("")
      setOptionId(NONE)
      setOrganizationId(NONE)
      setOrgSearch("")
      setNotes("")
      setPersonMode("existing")
      setPersonId("")
      setPersonSearch("")
      setNewPerson({ firstName: "", lastName: "", email: "", phone: "" })
      setSharedRoomEnabled(false)
      setSharedRoomMode("create")
      setSharedRoomGroupId("")
      setError(null)
    } else if (defaultProductId) {
      setProductId(defaultProductId)
    }
  }, [open, defaultProductId])

  const { data: productsData } = useProducts({
    search: productSearch || undefined,
    limit: 20,
    enabled: open,
  })
  const products = productsData?.data ?? []

  const { data: optionsData } = useProductOptions({
    productId: productId || undefined,
    limit: 50,
    enabled: open && Boolean(productId),
  })
  const options = optionsData?.data ?? []

  const { data: peopleData } = usePeople({
    search: personSearch || undefined,
    limit: 20,
    enabled: open && personMode === "existing",
  })
  const people = peopleData?.data ?? []

  const { data: orgsData } = useOrganizations({
    search: orgSearch || undefined,
    limit: 20,
    enabled: open,
  })
  const orgs = orgsData?.data ?? []

  const { create: createPerson } = usePersonMutation()
  const convertMutation = useBookingConvertMutation()
  const { create: createGroup } = useBookingGroupMutation()
  const { add: addGroupMember } = useBookingGroupMemberMutation()

  // Only load groups when shared-room+join is selected and we have a product
  const { data: groupsData } = useBookingGroups({
    productId: productId || undefined,
    limit: 50,
    enabled: open && sharedRoomEnabled && sharedRoomMode === "join" && Boolean(productId),
  })
  const existingGroups = groupsData?.data ?? []

  const handleSubmit = async () => {
    setError(null)

    if (!productId) {
      setError(messages.errorSelectProduct)
      return
    }

    let resolvedPersonId: string | null = null
    try {
      if (personMode === "existing") {
        if (!personId) {
          setError(messages.errorSelectPerson)
          return
        }
        resolvedPersonId = personId
      } else {
        if (!newPerson.firstName.trim() || !newPerson.lastName.trim()) {
          setError(messages.errorNameRequired)
          return
        }
        const person = await createPerson.mutateAsync({
          firstName: newPerson.firstName.trim(),
          lastName: newPerson.lastName.trim(),
          email: newPerson.email.trim() || null,
          phone: newPerson.phone.trim() || null,
        })
        resolvedPersonId = person.id
      }

      // Validate shared-room selection before creating the booking so we don't
      // create an orphan booking if the user picked "join" without a group.
      if (sharedRoomEnabled && sharedRoomMode === "join" && !sharedRoomGroupId) {
        setError(messages.errorSelectSharedRoom)
        return
      }

      const booking = await convertMutation.mutateAsync({
        productId,
        bookingNumber: generateBookingNumber(),
        optionId: optionId === NONE ? null : optionId,
        personId: resolvedPersonId,
        organizationId: organizationId === NONE ? null : organizationId,
        internalNotes: notes.trim() || null,
      })

      // Shared-room group linkage happens after booking creation.
      if (sharedRoomEnabled) {
        let targetGroupId = sharedRoomGroupId
        let role: "primary" | "shared" = "shared"

        if (sharedRoomMode === "create") {
          const group = await createGroup.mutateAsync({
            kind: "shared_room",
            label: `Shared room — ${booking.bookingNumber}`,
            productId: productId || null,
            optionUnitId: optionId === NONE ? null : optionId,
            primaryBookingId: booking.id,
          })
          targetGroupId = group.id
          role = "primary"
        }

        await addGroupMember.mutateAsync({
          groupId: targetGroupId,
          bookingId: booking.id,
          role,
        })
      }

      onOpenChange(false)
      onCreated?.(booking)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.errorCreateFailed)
    }
  }

  const isSubmitting =
    convertMutation.isPending ||
    createPerson.isPending ||
    createGroup.isPending ||
    addGroupMember.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {/* Product — hidden when pre-selected from a product page */}
          {!defaultProductId ? (
            <div className="flex flex-col gap-2">
              <Label>
                {messages.productLabel} <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={messages.productSearchPlaceholder}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={productId}
                onValueChange={(v) => {
                  setProductId(v ?? "")
                  setOptionId(NONE)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={messages.productSelectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Option (if product has options) */}
          {productId && options.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>{messages.optionLabel}</Label>
              <Select
                items={[
                  { label: messages.optionNone, value: NONE },
                  ...options.map((o) => ({ label: o.name, value: o.id })),
                ]}
                value={optionId}
                onValueChange={(v) => setOptionId(v ?? NONE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{messages.optionNone}</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Person */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>
                {messages.personLabel} <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setPersonMode(personMode === "existing" ? "new" : "existing")}
              >
                {personMode === "existing" ? (
                  <>
                    <UserPlus className="mr-1 h-3.5 w-3.5" />
                    {messages.createNewPerson}
                  </>
                ) : (
                  messages.selectExistingPerson
                )}
              </Button>
            </div>

            {personMode === "existing" ? (
              <>
                <Input
                  placeholder={messages.personSearchPlaceholder}
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
                <Select
                  value={personId}
                  onValueChange={(v) => setPersonId(v ?? "")}
                  items={people.map((p) => ({
                    label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ""}`,
                    value: p.id,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={messages.personSelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                        {p.email ? ` · ${p.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{messages.firstNameLabel}</Label>
                  <Input
                    value={newPerson.firstName}
                    onChange={(e) => setNewPerson({ ...newPerson, firstName: e.target.value })}
                    placeholder={messages.firstNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{messages.lastNameLabel}</Label>
                  <Input
                    value={newPerson.lastName}
                    onChange={(e) => setNewPerson({ ...newPerson, lastName: e.target.value })}
                    placeholder={messages.lastNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{messages.emailLabel}</Label>
                  <Input
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                    placeholder={messages.emailPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{messages.phoneLabel}</Label>
                  <Input
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                    placeholder={messages.phonePlaceholder}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Organization (optional) */}
          <div className="flex flex-col gap-2">
            <Label>{messages.organizationLabel}</Label>
            <Input
              placeholder={messages.organizationSearchPlaceholder}
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
            />
            <Select
              items={[
                { label: messages.organizationNone, value: NONE },
                ...orgs.map((o) => ({ label: o.name, value: o.id })),
              ]}
              value={organizationId}
              onValueChange={(v) => setOrganizationId(v ?? NONE)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={messages.organizationNone} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{messages.organizationNone}</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shared room */}
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <input
                id="booking-create-shared-room"
                type="checkbox"
                checked={sharedRoomEnabled}
                onChange={(e) => setSharedRoomEnabled(e.target.checked)}
              />
              <Label htmlFor="booking-create-shared-room" className="text-sm">
                {messages.sharedRoomLabel}
              </Label>
            </div>

            {sharedRoomEnabled && (
              <div className="flex flex-col gap-2 pl-6">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={sharedRoomMode === "create" ? "default" : "ghost"}
                    onClick={() => setSharedRoomMode("create")}
                  >
                    {messages.sharedRoomCreate}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sharedRoomMode === "join" ? "default" : "ghost"}
                    onClick={() => setSharedRoomMode("join")}
                  >
                    {messages.sharedRoomJoin}
                  </Button>
                </div>

                {sharedRoomMode === "join" && (
                  <Select
                    items={
                      existingGroups.length === 0
                        ? [{ label: messages.sharedRoomNoGroups, value: NONE }]
                        : existingGroups.map((g) => ({ label: g.label, value: g.id }))
                    }
                    value={sharedRoomGroupId || NONE}
                    onValueChange={(v) => setSharedRoomGroupId(v === NONE ? "" : (v ?? ""))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={messages.sharedRoomSelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {existingGroups.length === 0 ? (
                        <SelectItem value={NONE} disabled>
                          {messages.sharedRoomNoGroups}
                        </SelectItem>
                      ) : (
                        existingGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {sharedRoomMode === "create" && (
                  <p className="text-xs text-muted-foreground">{messages.sharedRoomCreateHint}</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label>{messages.notesLabel}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={messages.notesPlaceholder}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {messages.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !productId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
