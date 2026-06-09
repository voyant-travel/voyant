import { useNavigate } from "@tanstack/react-router"
import {
  type UpdateQuoteInput,
  useActivities,
  useOrganization,
  usePerson,
  usePipeline,
  useQuote,
  useQuoteMutation,
  useQuoteVersionMutation,
  useQuoteVersions,
  useStages,
} from "@voyantjs/crm-react"
import { Button, Card, CardTitle, ConfirmActionButton } from "@voyantjs/ui/components"
import { ArrowLeft, Ban, CheckCircle2, Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import {
  QuoteActivitiesCard,
  QuoteDetailsCard,
  QuoteParticipantsCard,
  QuoteSummaryCard,
  QuoteTagsCard,
  QuoteVersionsCard,
} from "./quote-detail-sections"

export function QuoteDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const [lostReasonDraft, setLostReasonDraft] = useState("")
  const [showLostDialog, setShowLostDialog] = useState(false)

  const quoteQuery = useQuote(id)
  const { remove, update } = useQuoteMutation()
  const { create: createQuoteVersion } = useQuoteVersionMutation()

  const updateField = async (patch: UpdateQuoteInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const quote = quoteQuery.data
  const personQuery = usePerson(quote?.personId ?? undefined, {
    enabled: Boolean(quote?.personId),
  })
  const organizationQuery = useOrganization(quote?.organizationId ?? undefined, {
    enabled: Boolean(quote?.organizationId),
  })
  const pipelineQuery = usePipeline(quote?.pipelineId, {
    enabled: Boolean(quote?.pipelineId),
  })
  const stagesQuery = useStages({
    pipelineId: quote?.pipelineId,
    limit: 100,
    enabled: Boolean(quote?.pipelineId),
  })
  const activitiesQuery = useActivities({
    entityType: "quote",
    entityId: id,
    limit: 50,
    enabled: Boolean(quote),
  })
  const quoteVersionsQuery = useQuoteVersions({
    quoteId: id,
    limit: 50,
    enabled: Boolean(quote),
  })

  const stages = useMemo(
    () => [...(stagesQuery.data?.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  )
  const activities = activitiesQuery.data?.data ?? []
  const currentStage = stages.find((stage) => stage.id === quote?.stageId)
  const person = personQuery.data
  const organization = organizationQuery.data

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

  const currentQuote = quote

  const personName = person
    ? [person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed person"
    : null

  async function markWon() {
    const wonStage = stages.find((stage) => stage.isWon)
    await updateField({
      status: "won",
      ...(wonStage ? { stageId: wonStage.id } : {}),
    })
  }

  async function submitLost() {
    const lostStage = stages.find((stage) => stage.isLost)
    await updateField({
      status: "lost",
      lostReason: lostReasonDraft.trim() || null,
      ...(lostStage ? { stageId: lostStage.id } : {}),
    })
    setShowLostDialog(false)
    setLostReasonDraft("")
  }

  async function reopen() {
    await updateField({ status: "open", lostReason: null })
  }

  async function createQuoteVersionForQuote() {
    const quoteVersion = await createQuoteVersion.mutateAsync({
      quoteId: id,
      input: {
        currency: currentQuote.valueCurrency ?? "USD",
      },
    })
    void navigate({ to: "/quote-versions/$id", params: { id: quoteVersion.id } })
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
          <span className="truncate text-foreground">{currentQuote.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createQuoteVersionForQuote()}
            disabled={createQuoteVersion.isPending}
          >
            {createQuoteVersion.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            New quote version
          </Button>
          {currentQuote.status === "open" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void markWon()}
                disabled={update.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Mark won
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLostDialog(true)}
                disabled={update.isPending}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                Mark lost
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reopen()}
              disabled={update.isPending}
            >
              Reopen
            </Button>
          )}
          <ConfirmActionButton
            buttonLabel="Delete"
            confirmLabel="Delete"
            title="Delete this quote?"
            description="This will permanently remove the quote. This action cannot be undone."
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

      {showLostDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-4">
            <CardTitle className="mb-2">Mark quote as lost</CardTitle>
            <p className="mb-3 text-sm text-muted-foreground">Optionally add a lost reason.</p>
            <textarea
              value={lostReasonDraft}
              onChange={(e) => setLostReasonDraft(e.target.value)}
              placeholder="Reason (optional)…"
              className="w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowLostDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submitLost()} disabled={update.isPending}>
                Mark lost
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4">
          <QuoteSummaryCard
            title={quote.title}
            pipelineName={pipelineQuery.data?.name}
            stageName={currentStage?.name}
            status={currentQuote.status}
            valueAmountCents={currentQuote.valueAmountCents}
            valueCurrency={currentQuote.valueCurrency}
            expectedCloseDate={currentQuote.expectedCloseDate}
          />
          <QuoteDetailsCard
            quote={currentQuote}
            stages={stages}
            onUpdateField={(patch) => updateField(patch as UpdateQuoteInput)}
          />
          <QuoteTagsCard tags={currentQuote.tags} onChange={(tags) => updateField({ tags })} />
        </aside>

        <main className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <QuoteParticipantsCard
            person={person}
            personName={personName}
            organization={organization}
            onOpenPerson={() => {
              if (person) void navigate({ to: "/people/$id", params: { id: person.id } })
            }}
            onOpenOrganization={() => {
              if (organization) {
                void navigate({ to: "/organizations/$id", params: { id: organization.id } })
              }
            }}
          />
          <QuoteVersionsCard
            isPending={quoteVersionsQuery.isPending}
            quoteVersions={quoteVersionsQuery.data?.data ?? []}
            isCreating={createQuoteVersion.isPending}
            onCreateQuoteVersion={() => {
              void createQuoteVersionForQuote()
            }}
            onOpenQuoteVersion={(quoteVersionId) => {
              void navigate({ to: "/quote-versions/$id", params: { id: quoteVersionId } })
            }}
          />
          <QuoteActivitiesCard isPending={activitiesQuery.isPending} activities={activities} />
        </main>
      </div>
    </div>
  )
}
