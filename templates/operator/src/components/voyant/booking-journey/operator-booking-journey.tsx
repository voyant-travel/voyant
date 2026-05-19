"use client"

/**
 * Operator-flavored wrapper around `<BookingJourney />` —
 * supplies CRM-backed contact pickers, B2B billing default, and
 * post-commit navigation to /orders/catalog.
 *
 * Per booking-journey-architecture §8.1 + §10 Phase B.
 */

import { useNavigate } from "@tanstack/react-router"
import { PersonPickerSection, type PersonPickerValue } from "@voyantjs/bookings-ui"
import { BookingJourney, type BookingJourneyProps } from "@voyantjs/bookings-ui/journey"
import { useState } from "react"

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

  const slots: Pick<
    BookingJourneyProps,
    | "renderLeadContactPicker"
    | "renderTravelerContactPicker"
    | "renderPaymentProviderStep"
    | "onCommitted"
    | "onCancelled"
  > = {
    renderLeadContactPicker({ apply }) {
      return <CrmLeadPicker apply={apply} />
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
      navigate({ to: "/catalog" })
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
      className={className}
      {...slots}
    />
  )
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
  const [value, setValue] = useState<PersonPickerValue>(emptyPersonPickerValue)

  function commit(next: PersonPickerValue): void {
    setValue(next)
    if (next.mode === "existing" && next.personId) {
      // Caller looks up the person by id from CRM; the picker
      // section also exposes the picked person via the search
      // dropdown, so we propagate the id here. Names default to
      // empty — the journey's billing form gets populated from the
      // CRM hydration on the next render.
      apply({
        firstName: "",
        lastName: "",
        personId: next.personId,
      })
      return
    }
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
        person: variant === "traveler" ? "Traveler" : "Lead contact",
      }}
    />
  )
}
