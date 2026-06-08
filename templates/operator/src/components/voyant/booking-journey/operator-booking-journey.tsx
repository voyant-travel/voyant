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
} from "@voyantjs/bookings-ui/journey"
import { usePerson } from "@voyantjs/crm-react"
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
    renderLeadContactPicker({ apply }) {
      return <CrmLeadPicker apply={apply} />
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
    renderTravelerContactPicker({ apply }) {
      // Travelers reuse the same picker; the operator picks an
      // existing CRM person or fills the inline-create form.
      return <CrmLeadPicker apply={apply} variant="traveler" />
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
      paymentCapabilities={{
        acceptsCard: true,
        acceptsHold: true,
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
 * CRM-backed picker that owns its own PersonPickerSection state and
 * notifies the journey via `apply` once the operator picks (or
 * inline-creates) a person. Used for both the lead-contact slot and
 * the per-traveler slot — the variant prop only changes the label.
 */
function CrmLeadPicker({
  apply,
  variant = "lead",
}: {
  apply: (contact: {
    firstName: string
    lastName: string
    email?: string
    phone?: string
    personId?: string
  }) => void
  variant?: "lead" | "traveler"
}): React.ReactElement {
  const t = useAdminMessages().bookings.detail.bookingJourney
  const [value, setValue] = useState<PersonPickerValue>(emptyPersonPickerValue)

  // Hydrate the journey's form from the picked CRM person. The picker only
  // yields a personId on selection; we fetch the record and apply the real
  // name / email / phone so the operator doesn't retype them.
  const selectedPersonId = value.mode === "existing" && value.personId ? value.personId : undefined
  const personQuery = usePerson(selectedPersonId, { enabled: Boolean(selectedPersonId) })
  const appliedPersonId = useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: applies once per resolved person; the ref guards re-entry from apply()->setDraft re-renders
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

  function commit(next: PersonPickerValue): void {
    setValue(next)
    if (next.mode === "existing" && next.personId) {
      // Real fields are applied by the usePerson effect once the record
      // resolves. Reset the guard so re-picking a different person (or the
      // same one after a clear) re-hydrates.
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
      showOrganization={variant === "lead"}
      labels={{
        person: variant === "traveler" ? t.travelerPickerLabel : t.leadContactPickerLabel,
      }}
    />
  )
}
