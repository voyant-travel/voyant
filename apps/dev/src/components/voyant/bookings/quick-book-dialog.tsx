"use client"

import { useSlots } from "@voyantjs/availability-react"
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

function generateBookingNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BK-${y}${m}-${seq}`
}

const NONE = "__none__"

export interface QuickBookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (booking: BookingRecord) => void
}

type PersonMode = "existing" | "new"

export function QuickBookDialog({ open, onOpenChange, onCreated }: QuickBookDialogProps) {
  const [productId, setProductId] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [optionId, setOptionId] = React.useState<string>(NONE)
  const [slotId, setSlotId] = React.useState<string>(NONE)
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
      setProductId("")
      setProductSearch("")
      setOptionId(NONE)
      setSlotId(NONE)
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
    }
  }, [open])

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

  const { data: slotsData } = useSlots({
    productId: productId || undefined,
    status: "open",
    limit: 100,
    enabled: open && Boolean(productId),
  })
  const allSlots = slotsData?.data ?? []
  const slots = React.useMemo(() => {
    const nowIso = new Date().toISOString()
    return allSlots
      .filter((slot) => slot.startsAt >= nowIso)
      .filter((slot) => {
        if (optionId === NONE) return true
        return slot.optionId === null || slot.optionId === optionId
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [allSlots, optionId])

  React.useEffect(() => {
    if (slotId === NONE) return
    if (!slots.some((slot) => slot.id === slotId)) setSlotId(NONE)
  }, [slotId, slots])

  const formatSlotLabel = React.useCallback((slot: (typeof slots)[number]) => {
    const date = new Date(slot.startsAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    const remaining =
      !slot.unlimited && typeof slot.remainingPax === "number" ? ` · ${slot.remainingPax} left` : ""
    return `${date}${remaining}`
  }, [])

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
      setError("Select a product")
      return
    }

    let resolvedPersonId: string | null = null
    try {
      if (personMode === "existing") {
        if (!personId) {
          setError("Select a person or switch to create mode")
          return
        }
        resolvedPersonId = personId
      } else {
        if (!newPerson.firstName.trim() || !newPerson.lastName.trim()) {
          setError("First and last name are required")
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
        setError("Select a shared-room group to join")
        return
      }

      const booking = await convertMutation.mutateAsync({
        productId,
        bookingNumber: generateBookingNumber(),
        optionId: optionId === NONE ? null : optionId,
        slotId: slotId === NONE ? null : slotId,
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
      setError(err instanceof Error ? err.message : "Failed to create booking")
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
          <DialogTitle>Quick Book</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {/* Product */}
          <div className="flex flex-col gap-2">
            <Label>
              Product <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <Select
              items={products.map((product) => ({ label: product.name, value: product.id }))}
              value={productId}
              onValueChange={(v) => {
                setProductId(v ?? "")
                setOptionId(NONE)
                setSlotId(NONE)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a product..." />
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

          {/* Option (if product has options) */}
          {productId && options.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Option</Label>
              <Select
                items={[
                  { label: "No specific option", value: NONE },
                  ...options.map((o) => ({ label: o.name, value: o.id })),
                ]}
                value={optionId}
                onValueChange={(v) => {
                  setOptionId(v ?? NONE)
                  setSlotId(NONE)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No specific option</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Departure (if product has open slots) */}
          {productId && (
            <div className="flex flex-col gap-2">
              <Label>Departure</Label>
              <Select value={slotId} onValueChange={(v) => setSlotId(v ?? NONE)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a departure..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No specific departure</SelectItem>
                  {slots.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      No open departures for this product
                    </SelectItem>
                  ) : (
                    slots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {formatSlotLabel(slot)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Person */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>
                Person <span className="text-destructive">*</span>
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
                    Create new
                  </>
                ) : (
                  "Select existing"
                )}
              </Button>
            </div>

            {personMode === "existing" ? (
              <>
                <Input
                  placeholder="Search people by name or email..."
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
                    <SelectValue placeholder="Select a person..." />
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
                  <Label className="text-xs">First Name</Label>
                  <Input
                    value={newPerson.firstName}
                    onChange={(e) => setNewPerson({ ...newPerson, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input
                    value={newPerson.lastName}
                    onChange={(e) => setNewPerson({ ...newPerson, lastName: e.target.value })}
                    placeholder="Smith"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                    placeholder="+44 7911 123456"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Organization (optional) */}
          <div className="flex flex-col gap-2">
            <Label>Organization (optional)</Label>
            <Input
              placeholder="Search organizations..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
            />
            <Select
              items={[
                { label: "No organization", value: NONE },
                ...orgs.map((o) => ({ label: o.name, value: o.id })),
              ]}
              value={organizationId}
              onValueChange={(v) => setOrganizationId(v ?? NONE)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No organization</SelectItem>
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
                id="quick-book-shared-room"
                type="checkbox"
                checked={sharedRoomEnabled}
                onChange={(e) => setSharedRoomEnabled(e.target.checked)}
              />
              <Label htmlFor="quick-book-shared-room" className="text-sm">
                Link to a shared-room group
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
                    Create new group
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sharedRoomMode === "join" ? "default" : "ghost"}
                    onClick={() => setSharedRoomMode("join")}
                  >
                    Join existing
                  </Button>
                </div>

                {sharedRoomMode === "join" && (
                  <Select
                    items={
                      existingGroups.length === 0
                        ? [{ label: "No existing groups for this product", value: NONE }]
                        : existingGroups.map((g) => ({ label: g.label, value: g.id }))
                    }
                    value={sharedRoomGroupId || NONE}
                    onValueChange={(v) => setSharedRoomGroupId(v === NONE ? "" : (v ?? ""))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingGroups.length === 0 ? (
                        <SelectItem value={NONE} disabled>
                          No existing groups for this product
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
                  <p className="text-xs text-muted-foreground">
                    A new group will be created with this booking as the primary member.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick context for this booking..."
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
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !productId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Draft Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
