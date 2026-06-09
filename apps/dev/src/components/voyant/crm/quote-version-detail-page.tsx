import { useNavigate } from "@tanstack/react-router"
import {
  type UpdateQuoteVersionInput,
  useQuote,
  useQuoteVersion,
  useQuoteVersionLines,
  useQuoteVersionMutation,
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
import { formatDate, formatMoney, formatRelative } from "@/components/voyant/crm/crm-constants"
import { InlineCurrencyField } from "@/components/voyant/crm/inline-currency-field"
import { InlineField } from "@/components/voyant/crm/inline-field"
import { QuoteVersionLinesCard } from "./quote-version-detail-sections"

export function QuoteVersionDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()

  const quoteVersionQuery = useQuoteVersion(id)
  const quoteVersionLinesQuery = useQuoteVersionLines(id)
  const { remove, update, send, accept, decline, createLine, updateLine, removeLine } =
    useQuoteVersionMutation()

  const updateField = async (patch: UpdateQuoteVersionInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const quoteVersion = quoteVersionQuery.data
  const lines = quoteVersionLinesQuery.data ?? []

  const quoteQuery = useQuote(quoteVersion?.quoteId ?? undefined, {
    enabled: Boolean(quoteVersion?.quoteId),
  })
  const quote = quoteQuery.data

  if (quoteVersionQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quoteVersion) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Quote version not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/quote-versions" })}>
          Back to Quote Versions
        </Button>
      </div>
    )
  }

  const canEdit = quoteVersion.status === "draft"

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/quote-versions" })}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => void navigate({ to: "/quote-versions" })}
            className="hover:text-foreground"
          >
            Quote Versions
          </button>
          <span>/</span>
          <span className="font-mono text-foreground">{quoteVersion.id.slice(-8)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {quoteVersion.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void send.mutateAsync({ id })}
              disabled={send.isPending}
            >
              Mark sent
            </Button>
          ) : null}
          {quoteVersion.status === "sent" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void accept.mutateAsync(id)}
                disabled={accept.isPending}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void decline.mutateAsync(id)}
                disabled={decline.isPending}
              >
                Decline
              </Button>
            </>
          ) : null}
          <ConfirmActionButton
            buttonLabel="Delete"
            confirmLabel="Delete"
            title="Delete this quote version?"
            description="This will permanently remove the quote version and all its lines."
            variant="destructive"
            confirmVariant="destructive"
            disabled={!canEdit || remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync(id)
              void navigate({ to: "/quote-versions" })
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
                {formatMoney(quoteVersion.totalAmountCents, quoteVersion.currency)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {quoteVersion.status}
                </Badge>
                {quoteVersion.validUntil ? (
                  <span className="text-xs text-muted-foreground">
                    Valid until {formatDate(quoteVersion.validUntil)}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quote version details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <InlineCurrencyField
                label="Currency"
                value={quoteVersion.currency}
                disabled={!canEdit}
                onSave={(next) => updateField({ currency: next ?? quoteVersion.currency })}
              />
              <InlineField
                label="Valid until"
                placeholder="YYYY-MM-DD"
                value={quoteVersion.validUntil}
                disabled={!canEdit}
                onSave={(next) => updateField({ validUntil: next })}
              />
              <InlineField
                label="Notes"
                kind="textarea"
                value={quoteVersion.notes}
                disabled={!canEdit}
                onSave={(next) => updateField({ notes: next })}
              />
            </CardContent>
          </Card>

          {quote ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Parent quote</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/quotes/$id",
                      params: { id: quote.id },
                    })
                  }
                  className="w-full rounded border p-2 text-left text-sm hover:bg-muted/40"
                >
                  <p className="truncate font-medium">{quote.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(quote.valueAmountCents, quote.valueCurrency)}
                    {" · "}
                    {quote.status}
                  </p>
                </button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-col gap-1 pt-6 text-xs text-muted-foreground">
              <span>Created {formatRelative(quoteVersion.createdAt)}</span>
              <span>Updated {formatRelative(quoteVersion.updatedAt)}</span>
            </CardContent>
          </Card>
        </aside>

        <main className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <QuoteVersionLinesCard
            currency={quoteVersion.currency}
            lines={lines}
            isLoading={quoteVersionLinesQuery.isPending}
            editable={canEdit}
            onCreate={async (input) => {
              await createLine.mutateAsync({ quoteVersionId: id, input })
            }}
            onUpdate={async (lineId, input) => {
              await updateLine.mutateAsync({ quoteVersionId: id, lineId, input })
            }}
            onRemove={async (lineId) => {
              await removeLine.mutateAsync({ quoteVersionId: id, lineId })
            }}
          />
        </main>
      </div>
    </div>
  )
}
