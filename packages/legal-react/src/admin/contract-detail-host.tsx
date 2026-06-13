"use client"

import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
import { useBooking } from "@voyantjs/bookings-react"
import { usePerson } from "@voyantjs/relationships-react"
import type { MouseEvent, ReactNode } from "react"
import {
  ContractDetailPage,
  type ContractReferenceRenderProps,
} from "../components/contract-detail-page.js"
import {
  useLegalContract,
  useLegalContractNumberSeries,
  useLegalContractTemplates,
  useVoyantLegalContext,
} from "../index.js"
import { ContractDialog } from "./contract-dialog.js"

export interface ContractDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the operator-grade contract detail page
 * (packaged-admin RFC Phase 3). Owns everything package-clean:
 *
 *   - Data access through `@voyantjs/legal-react` / `@voyantjs/relationships-react` /
 *     `@voyantjs/bookings-react` hooks (shared Voyant provider context — no
 *     app RPC client).
 *   - Admin chrome breadcrumbs (`Legal › Contracts › <number-or-title>`)
 *     with hrefs resolved through the `legal.home` / `contract.list`
 *     semantic destinations.
 *   - Reference cells (person, booking, template version, number series)
 *     resolve operator-friendly labels; person/booking link through the
 *     `person.detail` / `booking.detail` destinations.
 *   - The attachment download href is built from the shared legal provider
 *     context's `baseUrl` instead of a host env helper.
 */
export function ContractDetailHost({ id }: ContractDetailHostProps) {
  const messages = useOperatorAdminMessages()
  const resolveHref = useAdminHref()
  const { baseUrl } = useVoyantLegalContext()

  // Hook into the admin breadcrumb chain so the contract detail page
  // shows `Legal › Contracts › <number-or-title>` instead of just
  // "Contracts". The contract is already in the query cache thanks to
  // the route loader so this is a free read.
  const { data: contract } = useLegalContract(id)
  const trailLabel = contract?.contractNumber ?? contract?.title ?? `Contract ${id.slice(-8)}`
  useAdminBreadcrumbs([
    { label: messages.nav.legal, href: resolveHref("legal.home", {}) },
    { label: messages.nav.contracts, href: resolveHref("contract.list", {}) },
    { label: trailLabel },
  ])

  // Resolve the customer's email so the Send-contract dialog can
  // prefill the recipient. The contract's linked person is the
  // canonical billing contact; we read the hydrated `email` column
  // (sourced from `identity_contact_points` via the person_directory
  // view) rather than walking identity directly.
  const { data: person } = usePerson(contract?.personId ?? undefined, {
    enabled: Boolean(contract?.personId),
  })

  return (
    <ContractDetailPage
      id={id}
      renderContractDialog={(props) => <ContractDialog {...props} />}
      getAttachmentDownloadHref={(attachment) =>
        `${baseUrl}/v1/admin/legal/contracts/attachments/${attachment.id}/download`
      }
      resolveSendRecipientEmail={() => person?.email ?? null}
      renderReference={(props) => <ContractReferenceCell {...props} />}
    />
  )
}

/**
 * Resolve a contract's reference ids (person, booking, template
 * version, series, …) into operator-friendly labels — names + links
 * where it makes sense. The links resolve through semantic destinations
 * (RFC §4.7), keeping this host free of any app route-tree import.
 */
function ContractReferenceCell({ kind, id }: ContractReferenceRenderProps) {
  switch (kind) {
    case "person":
      return <PersonReference personId={id} />
    case "booking":
      return <BookingReference bookingId={id} />
    case "templateVersion":
      return <TemplateVersionReference templateVersionId={id} />
    case "series":
      return <SeriesReference seriesId={id} />
    default:
      // Org / supplier / channel / order — no dedicated resolver yet,
      // so fall through to the raw id. Wiring those when their detail
      // pages land in the operator template.
      return <span className="font-mono text-xs">{id}</span>
  }
}

/** SPA-friendly destination link: real href for a11y, router navigate on click. */
function DestinationLink({
  href,
  onNavigate,
  children,
}: {
  href: string
  onNavigate: () => void
  children: ReactNode
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    onNavigate()
  }
  return (
    <a href={href} onClick={handleClick} className="text-primary hover:underline">
      {children}
    </a>
  )
}

function PersonReference({ personId }: { personId: string }) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const { data } = usePerson(personId)
  const label =
    data && (data.firstName || data.lastName)
      ? [data.firstName, data.lastName].filter(Boolean).join(" ").trim()
      : (data?.email ?? personId)
  return (
    <DestinationLink
      href={resolveHref("person.detail", { personId })}
      onNavigate={() => navigateTo("person.detail", { personId })}
    >
      {label}
    </DestinationLink>
  )
}

function BookingReference({ bookingId }: { bookingId: string }) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const { data } = useBooking(bookingId)
  const label = data?.data?.bookingNumber ?? bookingId
  return (
    <DestinationLink
      href={resolveHref("booking.detail", { bookingId })}
      onNavigate={() => navigateTo("booking.detail", { bookingId })}
    >
      {label}
    </DestinationLink>
  )
}

function TemplateVersionReference({ templateVersionId }: { templateVersionId: string }) {
  // Match the version id against each template's `currentVersionId`.
  // It's the common path (auto-gen + storefront both stamp the current
  // pointer); for archived versions there's no admin endpoint that
  // takes a version id directly today, so we fall back to the raw id.
  const { data } = useLegalContractTemplates({ limit: 50 })
  const match = data?.data?.find((t) => t.currentVersionId === templateVersionId)
  if (!match) {
    return <span className="font-mono text-xs">{templateVersionId}</span>
  }
  return <span>{match.name}</span>
}

function SeriesReference({ seriesId }: { seriesId: string }) {
  const { data } = useLegalContractNumberSeries({ limit: 50 })
  const match = data?.data?.find((s) => s.id === seriesId)
  if (!match) {
    return <span className="font-mono text-xs">{seriesId}</span>
  }
  return (
    <span>
      {match.name}
      {match.prefix ? (
        <span className="ml-1.5 text-muted-foreground text-xs">({match.prefix})</span>
      ) : null}
    </span>
  )
}
