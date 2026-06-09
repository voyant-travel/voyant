import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/proposal/$quoteVersionId")({
  component: ProposalRoute,
})

interface PublicProposalResponse {
  data: PublicProposal
}

interface PublicProposal {
  title: string
  status: string
  validUntil: string | null
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  totalAmountCents: number
  lines: Array<{
    description: string
    quantity: number
    unitPriceAmountCents: number
    totalAmountCents: number
    currency: string
  }>
  operator: {
    name: string
    legalName: string
    address: string
    phone: string
    email: string
    website: string
    license: string
    licenseAuthority: string
  } | null
  proposalUrl: string
}

interface DeclineProposalResponse {
  data: {
    status: string
  }
}

function ProposalRoute() {
  const { quoteVersionId } = Route.useParams()
  const queryClient = useQueryClient()
  const proposalQuery = useQuery({
    queryKey: ["public-proposal", quoteVersionId],
    queryFn: async () => {
      const res = await fetch(
        `${getApiUrl()}/v1/public/proposals/${encodeURIComponent(quoteVersionId)}`,
        { headers: { Accept: "application/json" } },
      )
      const body = (await res.json()) as Partial<PublicProposalResponse> & { error?: string }
      if (!res.ok || !body.data) throw new Error(body.error ?? "Proposal not found")
      return body.data
    },
  })
  const decline = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${getApiUrl()}/v1/public/proposals/${encodeURIComponent(quoteVersionId)}/decline`,
        { method: "POST", headers: { Accept: "application/json" } },
      )
      const body = (await res.json()) as Partial<DeclineProposalResponse> & { error?: string }
      if (!res.ok || !body.data) throw new Error(body.error ?? "Could not decline proposal")
      return body.data
    },
    onSuccess: ({ status }) => {
      void queryClient.setQueryData<PublicProposal>(["public-proposal", quoteVersionId], (data) =>
        data ? { ...data, status } : data,
      )
    },
  })

  if (proposalQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef]">
        <Loader2 className="size-8 animate-spin text-[#52645d]" />
      </div>
    )
  }

  if (proposalQuery.isError || !proposalQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-4 text-center">
        <div className="max-w-md">
          <h1 className="font-semibold text-2xl text-[#232826]">Proposal unavailable</h1>
          <p className="mt-3 text-[#52645d] text-sm">
            {proposalQuery.error instanceof Error
              ? proposalQuery.error.message
              : "This proposal is no longer available."}
          </p>
        </div>
      </div>
    )
  }

  const proposal = proposalQuery.data
  const operatorName =
    proposal.operator?.name || proposal.operator?.legalName || "Your travel specialist"
  const canDecline = proposal.status === "sent"

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#232826]">
      <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-[#d8d2c3] border-b pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-[#52645d] text-sm">{operatorName}</p>
              <h1 className="mt-2 max-w-3xl font-semibold text-3xl sm:text-4xl">
                {proposal.title}
              </h1>
            </div>
            <StatusPill status={proposal.status} />
          </div>
        </header>

        <section className="grid gap-4 border-[#d8d2c3] border-b pb-6 sm:grid-cols-3">
          <Metric label="Total" value={formatMoney(proposal.totalAmountCents, proposal.currency)} />
          <Metric label="Valid until" value={formatDate(proposal.validUntil)} />
          <Metric label="Status" value={formatStatus(proposal.status)} />
        </section>

        <section className="overflow-hidden border border-[#d8d2c3] bg-white">
          <div className="grid grid-cols-12 border-[#d8d2c3] border-b bg-[#f0ece1] px-4 py-3 font-medium text-[#52645d] text-xs uppercase">
            <div className="col-span-6">Item</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          {proposal.lines.length === 0 ? (
            <p className="px-4 py-8 text-center text-[#52645d] text-sm">No proposal lines</p>
          ) : (
            <ul className="divide-y divide-[#e7e1d3]">
              {proposal.lines.map((line) => (
                <li
                  key={proposalLineKey(line)}
                  className="grid grid-cols-12 items-center gap-2 px-4 py-4"
                >
                  <div className="col-span-6 min-w-0">
                    <p className="break-words font-medium">{line.description}</p>
                  </div>
                  <div className="col-span-2 text-right text-[#52645d]">{line.quantity}</div>
                  <div className="col-span-2 text-right text-[#52645d]">
                    {formatMoney(line.unitPriceAmountCents, line.currency)}
                  </div>
                  <div className="col-span-2 text-right font-medium">
                    {formatMoney(line.totalAmountCents, line.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 border-[#d8d2c3] border-t bg-[#fbfaf6] px-4 py-4 text-sm">
            <AmountRow
              label="Subtotal"
              value={formatMoney(proposal.subtotalAmountCents, proposal.currency)}
            />
            <AmountRow
              label="Tax"
              value={formatMoney(proposal.taxAmountCents, proposal.currency)}
            />
            <AmountRow
              label="Total"
              value={formatMoney(proposal.totalAmountCents, proposal.currency)}
              strong
            />
          </div>
        </section>

        <footer className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <OperatorContact operator={proposal.operator} />
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {decline.error ? (
              <p className="text-[#9f3a2f] text-sm">
                {decline.error instanceof Error ? decline.error.message : "Request failed"}
              </p>
            ) : null}
            {canDecline ? (
              <button
                type="button"
                className="h-10 border border-[#9f3a2f] px-4 font-medium text-[#9f3a2f] text-sm transition hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={decline.isPending}
                onClick={() => {
                  if (window.confirm("Decline this proposal?")) void decline.mutateAsync()
                }}
              >
                {decline.isPending ? "Declining..." : "Decline"}
              </button>
            ) : null}
          </div>
        </footer>
      </main>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const palette =
    status === "sent"
      ? "border-[#6f7d4e] bg-[#eef4df] text-[#3f4b26]"
      : status === "declined" || status === "expired"
        ? "border-[#cda69b] bg-[#fff1ef] text-[#9f3a2f]"
        : "border-[#b9b2a2] bg-[#f7f5ef] text-[#52645d]"

  return (
    <span
      className={`inline-flex h-8 shrink-0 items-center justify-center border px-3 font-medium text-sm ${palette}`}
    >
      {formatStatus(status)}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-[#52645d] text-xs uppercase">{label}</p>
      <p className="mt-1 font-semibold text-xl">{value}</p>
    </div>
  )
}

function AmountRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold text-lg" : ""}`}>
      <span className="text-[#52645d]">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function OperatorContact({ operator }: { operator: PublicProposal["operator"] }) {
  if (!operator) return <p className="text-[#52645d] text-sm">Travel specialist</p>

  const contact = [operator.email, operator.phone, operator.website].filter(Boolean).join(" / ")

  return (
    <div className="max-w-xl text-[#52645d] text-sm">
      <p className="font-medium text-[#232826]">{operator.legalName || operator.name}</p>
      {operator.address ? <p className="mt-1">{operator.address}</p> : null}
      {contact ? <p className="mt-1 break-words">{contact}</p> : null}
      {operator.license ? (
        <p className="mt-1">
          {operator.license}
          {operator.licenseAuthority ? `, ${operator.licenseAuthority}` : ""}
        </p>
      ) : null}
    </div>
  )
}

function proposalLineKey(line: PublicProposal["lines"][number]) {
  return [
    line.description,
    line.quantity,
    line.unitPriceAmountCents,
    line.totalAmountCents,
    line.currency,
  ].join(":")
}

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amountCents / 100)
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function formatStatus(status: string) {
  return status.slice(0, 1).toUpperCase() + status.slice(1)
}
