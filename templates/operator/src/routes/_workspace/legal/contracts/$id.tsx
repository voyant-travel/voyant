import { createFileRoute, Link } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { useBooking } from "@voyantjs/bookings-react"
import { usePerson } from "@voyantjs/crm-react"
import {
  defaultFetcher,
  getLegalContractAttachmentsQueryOptions,
  getLegalContractQueryOptions,
  getLegalContractSignaturesQueryOptions,
  useLegalContract,
  useLegalContractNumberSeries,
  useLegalContractTemplates,
} from "@voyantjs/legal-react"
import { ContractDetailPage, type ContractReferenceRenderProps } from "@voyantjs/legal-ui"

import { ContractDialog } from "@/components/voyant/legal/contract-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/contracts/$id")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getLegalContractQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }, params.id),
      ),
      context.queryClient.ensureQueryData(
        getLegalContractSignaturesQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { contractId: params.id },
        ),
      ),
      context.queryClient.ensureQueryData(
        getLegalContractAttachmentsQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { contractId: params.id },
        ),
      ),
    ]),
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()

  // Hook into the admin breadcrumb chain so the contract detail page
  // shows `Legal › Contracts › <number-or-title>` instead of just
  // "Contracts". The contract is already in the query cache thanks to
  // the route loader so this is a free read.
  const { data: contract } = useLegalContract(id)
  const trailLabel = contract?.contractNumber ?? contract?.title ?? `Contract ${id.slice(-8)}`
  useAdminBreadcrumbs([
    { label: "Legal", href: "/legal" },
    { label: "Contracts", href: "/legal/contracts" },
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
        `/api/v1/admin/legal/contracts/attachments/${attachment.id}/download`
      }
      resolveSendRecipientEmail={() => person?.email ?? null}
      renderReference={(props) => <ContractReferenceCell {...props} />}
    />
  )
}

/**
 * Resolve a contract's reference ids (person, booking, template
 * version, series, …) into operator-friendly labels — names + links
 * where it makes sense. Keeps `@voyantjs/legal-ui` framework-agnostic
 * by handing all the data-source choices to the template.
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

function PersonReference({ personId }: { personId: string }) {
  const { data } = usePerson(personId)
  const label =
    data && (data.firstName || data.lastName)
      ? [data.firstName, data.lastName].filter(Boolean).join(" ").trim()
      : (data?.email ?? personId)
  return (
    <Link to="/people/$id" params={{ id: personId }} className="text-primary hover:underline">
      {label}
    </Link>
  )
}

function BookingReference({ bookingId }: { bookingId: string }) {
  const { data } = useBooking(bookingId)
  const label = data?.data?.bookingNumber ?? bookingId
  return (
    <Link to="/bookings/$id" params={{ id: bookingId }} className="text-primary hover:underline">
      {label}
    </Link>
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
