"use client"

/**
 * Operator-flavored wrapper around `<BookingJourney />` —
 * supplies CRM-backed contact pickers, B2B billing default, and
 * post-commit navigation to /orders/catalog.
 *
 * Per booking-journey-architecture §8.1 + §10 Phase B.
 */

import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { PersonPickerSection, type PersonPickerValue } from "@voyantjs/bookings-ui"
import {
  type BookingEntitySummary,
  BookingJourney,
  type BookingJourneyProps,
  type LeadContactPickerProps,
} from "@voyantjs/bookings-ui/journey"
import { useOrganization, usePerson } from "@voyantjs/crm-react"
import { useAddresses } from "@voyantjs/identity-react"
import { getProductMediaQueryOptions, getProductQueryOptions } from "@voyantjs/products-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { catalogVerticalPath } from "@/components/voyant/catalog/catalog-route-state"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"
import { OperatorDeparturePicker } from "./operator-departure-picker"
import { OperatorUnitsPicker } from "./operator-units-picker"

const emptyPersonPickerValue: PersonPickerValue = {
  mode: "existing",
  personId: "",
  newPerson: { firstName: "", lastName: "", email: "", phone: "" },
  organizationId: null,
}

export interface OperatorBookingJourneyProps {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceConnectionId?: string
  sourceRef?: string
  departureId?: string
  optionId?: string
  draftId: string
  className?: string
}

export function OperatorBookingJourney({
  entityModule,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  departureId,
  optionId,
  draftId,
  className,
}: OperatorBookingJourneyProps): React.ReactElement {
  const navigate = useNavigate()
  const entitySummary = useEntitySummary(entityModule, entityId, sourceKind)

  const slots: Pick<
    BookingJourneyProps,
    | "renderLeadContactPicker"
    | "renderTravelerContactPicker"
    | "renderDeparturePicker"
    | "renderUnitsPicker"
    | "renderPaymentProviderStep"
    | "onCommitted"
    | "onCancelled"
  > = {
    renderLeadContactPicker({ apply, buyerType }) {
      return <CrmLeadPicker apply={apply} buyerType={buyerType} />
    },
    renderDeparturePicker(pickerProps) {
      // Owned: real scheduled departures from availability. Sourced
      // products have none, so the picker falls back to a free date.
      return <OperatorDeparturePicker {...pickerProps} />
    },
    renderUnitsPicker(pickerProps) {
      // Rooms/units for the picked option + departure (operator inventory).
      return <OperatorUnitsPicker {...pickerProps} />
    },
    renderTravelerContactPicker({ apply, selectedPersonId }) {
      // Travelers reuse the same picker (person-only). Adapt the picker's
      // partial lead-apply to the traveler apply (always a person), and
      // reflect the row's linked person so "Copy from billing" selects it.
      return (
        <CrmLeadPicker
          variant="traveler"
          linkedPersonId={selectedPersonId}
          apply={(contact) =>
            apply({
              firstName: contact.firstName ?? "",
              lastName: contact.lastName ?? "",
              email: contact.email,
              phone: contact.phone,
              personId: contact.personId,
            })
          }
        />
      )
    },
    onCommitted(result) {
      navigate({ to: "/bookings", search: { highlight: result.bookingId } as never })
    },
    onCancelled() {
      navigate({ to: catalogVerticalPath(entityModule) })
    },
  }

  return (
    <BookingJourney
      surface="admin"
      entityModule={entityModule}
      entityId={entityId}
      sourceKind={sourceKind}
      sourceConnectionId={sourceConnectionId}
      sourceRef={sourceRef}
      draftId={draftId}
      initialConfigure={{
        ...(departureId ? { departureSlotId: departureId } : {}),
        ...(optionId ? { variantId: optionId } : {}),
      }}
      defaultBuyerType="B2B"
      // Operator payment options: hold (reserve, collect later), online payment
      // link (the customer pays via the hosted PSP page — we never charge a card
      // instantly here), bank transfer, and agency credit.
      paymentCapabilities={{
        acceptsCard: true,
        acceptsHold: true,
        acceptsBankTransfer: true,
        acceptsTicketOnCredit: true,
      }}
      entitySummary={entitySummary}
      className={className}
      {...slots}
    />
  )
}

/**
 * Builds the "what you're booking" preview shown atop the journey side
 * panel — the product's name + first image. Owned products only; sourced
 * rows resolve their summary server-side and aren't fetched here.
 */
function useEntitySummary(
  entityModule: string,
  entityId: string,
  sourceKind: string,
): BookingEntitySummary | undefined {
  const isOwnedProduct = sourceKind === "owned" && entityModule === "products"
  const client = useMemo(() => ({ baseUrl: getApiUrl(), fetcher: operatorFetcher }), [])

  const productQuery = useQuery({
    ...getProductQueryOptions(client, entityId),
    enabled: isOwnedProduct && Boolean(entityId),
  })
  const mediaQuery = useQuery({
    ...getProductMediaQueryOptions(client, entityId, { mediaType: "image" }),
    enabled: isOwnedProduct && Boolean(entityId),
  })

  return useMemo<BookingEntitySummary | undefined>(() => {
    const product = productQuery.data
    if (!product) return undefined
    // First product-level (not day-scoped) image, if any.
    const heroImageUrl = (mediaQuery.data?.data ?? [])
      .filter((media) => media.mediaType === "image" && media.dayId == null)
      .map((media) => media.url)
      .find(Boolean)
    return {
      name: product.name,
      vertical: "products",
      ...(heroImageUrl ? { heroImageUrl } : {}),
    }
  }, [productQuery.data, mediaQuery.data])
}

/**
 * CRM-backed picker for the journey's contact slots. Buyer type drives the
 * mode (there's no bill-to toggle): for the LEAD slot it searches PEOPLE on
 * B2C and ORGANIZATIONS on B2B — picking either hydrates the journey from the
 * CRM record (person → name/email/phone; org → company name/tax id). The
 * per-traveler slot is always a person picker.
 */
function CrmLeadPicker({
  apply,
  buyerType,
  variant = "lead",
  linkedPersonId,
}: {
  apply: LeadContactPickerProps["apply"]
  buyerType?: "B2C" | "B2B"
  variant?: "lead" | "traveler"
  /** Externally-linked person to reflect in the combobox (e.g. a traveler
   *  whose contact was copied from billing). */
  linkedPersonId?: string
}): React.ReactElement {
  const t = useAdminMessages().bookings.detail.bookingJourney
  // The lead picker bills an organization on B2B; everything else is a person.
  const orgMode = variant === "lead" && buyerType === "B2B"
  const [value, setValue] = useState<PersonPickerValue>(emptyPersonPickerValue)

  // Reflect an externally-set person (copy-from-billing, or a re-opened
  // draft) in the combobox. The hydrate effect below then fills the names;
  // the `appliedPersonId` ref keeps that idempotent.
  useEffect(() => {
    if (!linkedPersonId) return
    setValue((cur) =>
      cur.personId === linkedPersonId
        ? cur
        : { ...cur, mode: "existing", personId: linkedPersonId },
    )
  }, [linkedPersonId])

  // Keep the picker's target aligned with the Buyer type radio.
  useEffect(() => {
    setValue((current) => {
      const desired = orgMode ? "organization" : "person"
      return (current.billTo ?? "person") === desired ? current : { ...current, billTo: desired }
    })
  }, [orgMode])

  // Hydrate from the picked CRM person (B2C). The picker yields just an id;
  // we fetch the record and apply the real name/email/phone.
  const selectedPersonId =
    !orgMode && value.mode === "existing" && value.personId ? value.personId : undefined
  const personQuery = usePerson(selectedPersonId, { enabled: Boolean(selectedPersonId) })
  const appliedPersonId = useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: applies once per resolved record; the ref guards re-entry from apply()->setDraft re-renders
  useEffect(() => {
    const person = personQuery.data
    if (!person || appliedPersonId.current === person.id) return
    appliedPersonId.current = person.id
    apply({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email ?? undefined,
      phone: person.phone ?? undefined,
      personId: person.id,
    })
  }, [personQuery.data])

  // Hydrate the company fields from the picked CRM organization (B2B).
  const selectedOrgId = orgMode && value.organizationId ? value.organizationId : undefined
  const orgQuery = useOrganization(selectedOrgId, { enabled: Boolean(selectedOrgId) })
  const appliedOrgId = useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: applies once per resolved record; the ref guards re-entry
  useEffect(() => {
    const org = orgQuery.data
    if (!org || appliedOrgId.current === org.id) return
    appliedOrgId.current = org.id
    apply({
      organizationId: org.id,
      companyName: org.legalName ?? org.name,
      taxId: org.taxId ?? undefined,
    })
  }, [orgQuery.data])

  // Hydrate the billing address from the picked person (B2C) or org (B2B)
  // primary CRM address — so the operator never re-types it and the tax
  // country is set. Missing → surfaced as a warning to fix in the picker.
  const addressEntityType = orgMode ? "organization" : "person"
  // Only the billing lead pulls an address; travelers don't carry one.
  const addressEntityId =
    variant === "lead" ? (orgMode ? selectedOrgId : selectedPersonId) : undefined
  const addressQuery = useAddresses({
    entityType: addressEntityType,
    entityId: addressEntityId,
    isPrimary: true,
    limit: 1,
    enabled: Boolean(addressEntityId),
  })
  const appliedAddressKey = useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: applies once per resolved address; the ref guards re-entry
  useEffect(() => {
    const addr = addressQuery.data?.data?.[0]
    if (!addressEntityId || !addr) return
    const key = `${addressEntityType}:${addressEntityId}`
    if (appliedAddressKey.current === key) return
    appliedAddressKey.current = key
    apply({
      address: {
        line1: addr.line1 ?? undefined,
        line2: addr.line2 ?? undefined,
        city: addr.city ?? undefined,
        postal: addr.postalCode ?? undefined,
        country: addr.country ?? undefined,
      },
    })
  }, [addressQuery.data, addressEntityId])

  function commit(next: PersonPickerValue): void {
    setValue(next)
    if ((next.billTo ?? "person") === "organization") {
      if (next.organizationId !== appliedOrgId.current) appliedOrgId.current = null
      return
    }
    if (next.mode === "existing" && next.personId) {
      if (next.personId !== appliedPersonId.current) appliedPersonId.current = null
      return
    }
    appliedPersonId.current = null
    if (next.mode === "new") {
      apply({
        firstName: next.newPerson.firstName,
        lastName: next.newPerson.lastName,
        email: next.newPerson.email || undefined,
        phone: next.newPerson.phone || undefined,
      })
    }
  }

  return (
    <PersonPickerSection
      value={value}
      onChange={commit}
      // Org is an allowed target for the lead (so its CRM org search runs),
      // but the toggle is hidden — Buyer type is the single control.
      showOrganization={variant === "lead"}
      hideTargetToggle
      labels={{
        person: variant === "traveler" ? t.travelerPickerLabel : t.leadContactPickerLabel,
      }}
    />
  )
}
