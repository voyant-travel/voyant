import { useNavigate } from "@tanstack/react-router"
import {
  type UpdateQuoteInput,
  useOpportunity,
  useQuote,
  useQuoteLines,
  useQuoteMutation,
} from "@voyantjs/crm-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
} from "@voyantjs/ui/components"
import { ArrowLeft, Loader2 } from "lucide-react"
import {
  formatDate,
  formatMoney,
  formatRelative,
  QUOTE_STATUS_OPTIONS,
} from "@/components/voyant/crm/crm-constants"
import { InlineCurrencyField } from "@/components/voyant/crm/inline-currency-field"
import { InlineField } from "@/components/voyant/crm/inline-field"
import { InlineSelectField } from "@/components/voyant/crm/inline-select-field"
import { QuoteLinesCard } from "./quote-detail-sections"

export function QuoteDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()

  const quoteQuery = useQuote(id)
  const linesQuery = useQuoteLines(id)
  const { remove, update, createLine, updateLine, removeLine } = useQuoteMutation()

  const updateField = async (patch: UpdateQuoteInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const quote = quoteQuery.data
  const lines = linesQuery.data ?? []

  const opportunityQuery = useOpportunity(quote?.opportunityId ?? undefined, {
    enabled: Boolean(quote?.opportunityId),
  })
  const opportunity = opportunityQuery.data

  if (quoteQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Quote not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/quotes" })}>
          Back to Quotes
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/quotes" })}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => void navigate({ to: "/quotes" })}
            className="hover:text-foreground"
          >
            Quotes
          </button>
          <span>/</span>
          <span className="font-mono text-foreground">{quote.id.slice(-8)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {quote.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void updateField({ status: "sent" })}
              disabled={update.isPending}
            >
              Mark sent
            </Button>
          ) : null}
          {quote.status === "sent" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void updateField({ status: "accepted" })}
                disabled={update.isPending}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void updateField({ status: "rejected" })}
                disabled={update.isPending}
              >
                Reject
              </Button>
            </>
          ) : null}
          <ConfirmActionButton
            buttonLabel="Delete"
            confirmLabel="Delete"
            title="Delete this quote?"
            description="This will permanently remove the quote and all its lines."
            variant="destructive"
            confirmVariant="destructive"
            disabled={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync(id)
              void navigate({ to: "/quotes" })
            }}
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatMoney(quote.totalAmountCents, quote.currency)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {quote.status}
                </Badge>
                {quote.validUntil ? (
                  <span className="text-xs text-muted-foreground">
                    Valid until {formatDate(quote.validUntil)}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quote details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <InlineSelectField
                label="Status"
                value={quote.status}
                options={QUOTE_STATUS_OPTIONS}
                allowClear={false}
                onSave={(next) => updateField({ status: next ?? quote.status })}
              />
              <InlineCurrencyField
                label="Currency"
                value={quote.currency}
                onSave={(next) => updateField({ currency: next ?? quote.currency })}
              />
              <InlineField
                label="Valid until"
                placeholder="YYYY-MM-DD"
                value={quote.validUntil}
                onSave={(next) => updateField({ validUntil: next })}
              />
              <InlineField
                label="Notes"
                kind="textarea"
                value={quote.notes}
                onSave={(next) => updateField({ notes: next })}
              />
            </CardContent>
          </Card>

          {opportunity ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Linked opportunity</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/opportunities/$id",
                      params: { id: opportunity.id },
                    })
                  }
                  className="w-full rounded border p-2 text-left text-sm hover:bg-muted/40"
                >
                  <p className="truncate font-medium">{opportunity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(opportunity.valueAmountCents, opportunity.valueCurrency)}
                    {" · "}
                    {opportunity.status}
                  </p>
                </button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-col gap-1 pt-6 text-xs text-muted-foreground">
              <span>Created {formatRelative(quote.createdAt)}</span>
              <span>Updated {formatRelative(quote.updatedAt)}</span>
            </CardContent>
          </Card>
        </aside>

        <main className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <QuoteLinesCard
            currency={quote.currency}
            lines={lines}
            isLoading={linesQuery.isPending}
            onCreate={async (input) => {
              await createLine.mutateAsync({ quoteId: id, input })
            }}
            onUpdate={async (lineId, input) => {
              await updateLine.mutateAsync({ quoteId: id, lineId, input })
            }}
            onRemove={async (lineId) => {
              await removeLine.mutateAsync({ quoteId: id, lineId })
            }}
          />
        </main>
      </div>
    </div>
  )
}
