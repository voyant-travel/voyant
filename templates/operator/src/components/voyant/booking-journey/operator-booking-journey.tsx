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
import { getProductMediaQueryOptions, getProductQueryOptions } from "@voyantjs/products-react"
import { useMemo, useState } from "react"

import { catalogVerticalPath } from "@/components/voyant/catalog/catalog-route-state"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

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
  departureDate?: string
  optionId?: string
  roomTypeId?: string
  ratePlanId?: string
  board?: string
  entityName?: string
  entityImageUrl?: string
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
  departureDate,
  optionId,
  roomTypeId,
  ratePlanId,
  board,
  entityName,
  entityImageUrl,
  draftId,
  className,
}: OperatorBookingJourneyProps): React.ReactElement {
  const navigate = useNavigate()
  const entitySummary = useEntitySummary(entityModule, entityId, {
    name: entityName,
    heroImageUrl: entityImageUrl,
  })

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
        ...(departureDate ? { departureDate } : {}),
        ...(optionId ? { variantId: optionId } : {}),
        ...(roomTypeId ? { roomTypeId } : {}),
        ...(ratePlanId ? { ratePlanId } : {}),
        ...(board ? { board } : {}),
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

function useEntitySummary(
  entityModule: string,
  entityId: string,
  hints: { name?: string; heroImageUrl?: string },
): BookingEntitySummary | undefined {
  const tryProductSummary = entityModule === "products" && Boolean(entityId)
  const client = useMemo(() => ({ baseUrl: getApiUrl(), fetcher: operatorFetcher }), [])

  const productQuery = useQuery({
    ...getProductQueryOptions(client, entityId),
    enabled: tryProductSummary,
    retry: false,
  })
  const mediaQuery = useQuery({
    ...getProductMediaQueryOptions(client, entityId, { mediaType: "image" }),
    enabled: tryProductSummary,
    retry: false,
  })

  return useMemo<BookingEntitySummary | undefined>(() => {
    const product = productQuery.data
    if (product) {
      const heroImageUrl = (mediaQuery.data?.data ?? [])
        .filter((media) => media.mediaType === "image" && media.dayId == null)
        .map((media) => media.url)
        .find(Boolean)
      return {
        name: product.name,
        vertical: "products",
        ...(heroImageUrl ? { heroImageUrl } : {}),
      }
    }
    if (hints.name) {
      return {
        name: hints.name,
        vertical: entityModule,
        ...(hints.heroImageUrl ? { heroImageUrl: hints.heroImageUrl } : {}),
      }
    }
    return undefined
  }, [productQuery.data, mediaQuery.data, hints.name, hints.heroImageUrl, entityModule])
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
        person: variant === "traveler" ? t.travelerPickerLabel : t.leadContactPickerLabel,
      }}
    />
  )
}
