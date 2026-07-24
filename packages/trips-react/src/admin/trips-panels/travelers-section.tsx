"use client"

import { useOperatorAdminMessages as useAdminMessages } from "@voyant-travel/admin"
import { deriveTravelerRoleFromDob } from "@voyant-travel/bookings-react/components/travelers-section"
import { usePerson, usePersonRelationships } from "@voyant-travel/relationships-react"
import { PersonCombobox, PersonForm } from "@voyant-travel/relationships-react/ui"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyant-travel/ui/components/tooltip"
import { Info, Pencil, Trash2, UserPlus } from "lucide-react"
import * as React from "react"

export type TravelerCategory = "adult" | "child" | "infant"
export type TripTravelerRole = "lead" | TravelerCategory

export interface TripTraveler {
  localId: string
  personId: string | null
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string | null
  role: TripTravelerRole
}

function newTripTraveler(): TripTraveler {
  return {
    localId: `tt_${Math.random().toString(36).slice(2, 10)}`,
    personId: null,
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: null,
    role: "adult",
  }
}

export function TripTravelersSection({
  value,
  onChange,
  billingPersonId,
}: {
  value: TripTraveler[]
  onChange(next: TripTraveler[]): void
  billingPersonId?: string | null
}) {
  function patchAt(localId: string, patch: Partial<TripTraveler>) {
    onChange(
      value.map((traveler) =>
        traveler.localId === localId ? { ...traveler, ...patch } : traveler,
      ),
    )
  }
  function removeAt(localId: string) {
    onChange(value.filter((traveler) => traveler.localId !== localId))
  }
  function addTravelerByPersonId(personId: string) {
    if (value.some((traveler) => traveler.personId === personId)) return
    onChange([...value, { ...newTripTraveler(), personId }])
  }

  const existingPersonIds = new Set(value.map((traveler) => traveler.personId).filter(Boolean))

  // Lead = billing person when they're on the roster; otherwise the first
  // traveler. Keeps the "who is the primary traveler" intent natural without
  // forcing operators to reorder the list.
  const leadLocalId =
    (billingPersonId && value.find((t) => t.personId === billingPersonId)?.localId) ||
    value[0]?.localId ||
    null

  const t = useAdminMessages().trips.adminComposer.panels

  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-base">{t.travelersSectionTitle}</h2>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newTripTraveler()])}>
          <UserPlus className="size-3.5" />
          {t.addTravelerLabel}
        </Button>
      </div>

      {billingPersonId ? (
        <BillingQuickAdd
          billingPersonId={billingPersonId}
          existingPersonIds={existingPersonIds}
          onAdd={addTravelerByPersonId}
        />
      ) : null}

      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t.noTravelersPrefix}
          <span className="font-medium">{t.addTravelerLabel}</span>.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((traveler) => (
            <TripTravelerRow
              key={traveler.localId}
              traveler={traveler}
              isLead={traveler.localId === leadLocalId}
              onPatch={(patch) => patchAt(traveler.localId, patch)}
              onRemove={() => removeAt(traveler.localId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BillingQuickAdd({
  billingPersonId,
  existingPersonIds,
  onAdd,
}: {
  billingPersonId: string
  existingPersonIds: Set<string | null>
  onAdd(personId: string): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const billingPersonQuery = usePerson(billingPersonId)
  const relationshipsQuery = usePersonRelationships(billingPersonId)
  const billingPerson = billingPersonQuery.data
  const billingAlreadyAdded = existingPersonIds.has(billingPersonId)

  const relatedPersonIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const relationship of relationshipsQuery.data?.data ?? []) {
      const otherId =
        relationship.fromPersonId === billingPersonId
          ? relationship.toPersonId
          : relationship.fromPersonId
      if (otherId && otherId !== billingPersonId) ids.add(otherId)
    }
    return [...ids]
  }, [relationshipsQuery.data?.data, billingPersonId])

  const hasRelationships = relatedPersonIds.length > 0
  if (billingAlreadyAdded && !hasRelationships) return null

  const billingName = formatPersonName(billingPerson) ?? t.travelersAddRow.billingPersonFallback

  return (
    <div className="flex flex-col gap-2">
      {!billingAlreadyAdded ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onAdd(billingPersonId)}
        >
          <UserPlus className="size-3.5" />
          {t.travelersAddRow.addBillingPersonPrefix}
          {billingName}
          {t.travelersAddRow.addBillingPersonSuffix}
        </Button>
      ) : null}
      {hasRelationships ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t.travelersAddRow.fromRelationshipsPrefix}
            {billingName}
            {t.travelersAddRow.fromRelationshipsSuffix}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {relatedPersonIds.map((personId) => (
              <RelatedPersonChip
                key={personId}
                personId={personId}
                billingPersonId={billingPersonId}
                relationships={relationshipsQuery.data?.data ?? []}
                disabled={existingPersonIds.has(personId)}
                onAdd={() => onAdd(personId)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RelatedPersonChip({
  personId,
  billingPersonId,
  relationships,
  disabled,
  onAdd,
}: {
  personId: string
  billingPersonId: string
  relationships: Array<{
    fromPersonId: string
    toPersonId: string
    kind: string
    inverseKind: string | null
  }>
  disabled: boolean
  onAdd(): void
}) {
  const personQuery = usePerson(personId)
  const name = formatPersonName(personQuery.data) ?? "—"
  const relation = relationships.find(
    (relationship) =>
      (relationship.fromPersonId === billingPersonId && relationship.toPersonId === personId) ||
      (relationship.toPersonId === billingPersonId && relationship.fromPersonId === personId),
  )
  const kindLabel = relation
    ? formatRelationshipKind(
        relation.toPersonId === billingPersonId && relation.inverseKind
          ? relation.inverseKind
          : relation.kind,
      )
    : null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onAdd}
      className="h-auto py-1.5"
    >
      <UserPlus className="size-3.5" />
      <span>{name}</span>
      {kindLabel ? (
        <Badge variant="secondary" className="ml-1 text-[10px] capitalize">
          {kindLabel}
        </Badge>
      ) : null}
    </Button>
  )
}

export function formatPersonName(
  person:
    | {
        firstName?: string | null
        lastName?: string | null
        email?: string | null
      }
    | undefined
    | null,
): string | null {
  if (!person) return null
  const name = [person.firstName, person.lastName]
    .filter((part) => (part ?? "").trim().length > 0)
    .join(" ")
    .trim()
  return name || person.email || null
}

function formatRelationshipKind(kind: string): string {
  return kind.replaceAll("_", " ")
}

function TripTravelerRow({
  traveler,
  isLead,
  onPatch,
  onRemove,
}: {
  traveler: TripTraveler
  isLead: boolean
  onPatch(patch: Partial<TripTraveler>): void
  onRemove(): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const personQuery = usePerson(traveler.personId ?? undefined, {
    enabled: Boolean(traveler.personId),
  })

  React.useEffect(() => {
    const person = personQuery.data
    if (!person) return
    const nextDob = person.dateOfBirth ?? null
    const derivedCategory = deriveTravelerRoleFromDob(nextDob)
    const nextRole: TripTravelerRole = isLead
      ? "lead"
      : nextDob
        ? (derivedCategory as TravelerCategory)
        : traveler.role === "lead"
          ? "adult"
          : traveler.role
    const patch: Partial<TripTraveler> = {}
    if ((person.firstName ?? "") !== traveler.firstName) patch.firstName = person.firstName ?? ""
    if ((person.lastName ?? "") !== traveler.lastName) patch.lastName = person.lastName ?? ""
    if ((person.email ?? "") !== traveler.email) patch.email = person.email ?? ""
    if (nextDob !== traveler.dateOfBirth) patch.dateOfBirth = nextDob
    if (nextRole !== traveler.role) patch.role = nextRole
    if (Object.keys(patch).length > 0) onPatch(patch)
  }, [
    personQuery.data,
    isLead,
    onPatch,
    traveler.dateOfBirth,
    traveler.email,
    traveler.firstName,
    traveler.lastName,
    traveler.role,
  ])

  React.useEffect(() => {
    if (isLead && traveler.role !== "lead") onPatch({ role: "lead" })
    if (!isLead && traveler.role === "lead") {
      const derived = deriveTravelerRoleFromDob(traveler.dateOfBirth) as TravelerCategory
      onPatch({ role: derived })
    }
  }, [isLead, onPatch, traveler.dateOfBirth, traveler.role])

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const lockedByDob = Boolean(traveler.dateOfBirth)
  const displayCategory: TravelerCategory = lockedByDob
    ? (deriveTravelerRoleFromDob(traveler.dateOfBirth) as TravelerCategory)
    : traveler.role === "lead"
      ? "adult"
      : traveler.role

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PersonCombobox
            value={traveler.personId}
            onChange={(personId) => onPatch({ personId })}
            placeholder={t.personPickerPlaceholder}
          />
        </div>
        {traveler.personId && personQuery.data ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSheetMode("edit")
              setSheetOpen(true)
            }}
          >
            <Pencil className="size-3.5" />
            {t.travelerRow.editAction}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSheetMode("create")
            setSheetOpen(true)
          }}
        >
          <UserPlus className="size-3.5" />
          {t.travelerRow.newAction}
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "edit" ? t.travelerRow.editPerson : t.travelerRow.createPerson}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <PersonForm
              mode={
                sheetMode === "edit" && personQuery.data
                  ? { kind: "edit", person: personQuery.data }
                  : { kind: "create" }
              }
              onCancel={() => setSheetOpen(false)}
              onSuccess={(person) => {
                onPatch({ personId: person.id })
                setSheetOpen(false)
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>
      <div className="flex flex-wrap items-center gap-2">
        {isLead ? (
          <Badge>{t.leadBadge}</Badge>
        ) : (
          <>
            <CategoryToggle
              value={displayCategory}
              onChange={(role) => onPatch({ role })}
              disabled={lockedByDob}
            />
            {lockedByDob ? (
              <span className="text-muted-foreground text-xs">
                Auto from DOB ({formatDateOnly(traveler.dateOfBirth)})
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t.categoryManualAria}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{t.travelerRow.manualCategoryHint}</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onRemove}
          aria-label={t.removeTraveler}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function CategoryToggle({
  value,
  onChange,
  disabled,
}: {
  value: TravelerCategory
  onChange(value: TravelerCategory): void
  disabled?: boolean
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const options: Array<{ value: TravelerCategory; label: string }> = [
    { value: "adult", label: t.travelerRow.categoryAdult },
    { value: "child", label: t.travelerRow.categoryChild },
    { value: "infant", label: t.travelerRow.categoryInfant },
  ]
  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return ""
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed)
}
