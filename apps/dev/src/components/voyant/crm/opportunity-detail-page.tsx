import { useNavigate } from "@tanstack/react-router"
import {
  type UpdateOpportunityInput,
  useActivities,
  useOpportunity,
  useOpportunityMutation,
  useOrganization,
  usePerson,
  usePipeline,
  useQuoteMutation,
  useQuotes,
  useStages,
} from "@voyantjs/crm-react"
import { Button, Card, CardTitle, ConfirmActionButton } from "@voyantjs/ui/components"
import { ArrowLeft, Ban, CheckCircle2, Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import {
  OpportunityActivitiesCard,
  OpportunityDetailsCard,
  OpportunityParticipantsCard,
  OpportunityQuotesCard,
  OpportunitySummaryCard,
  OpportunityTagsCard,
} from "./opportunity-detail-sections"

export function OpportunityDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const [lostReasonDraft, setLostReasonDraft] = useState("")
  const [showLostDialog, setShowLostDialog] = useState(false)

  const opportunityQuery = useOpportunity(id)
  const { remove, update } = useOpportunityMutation()
  const { create: createQuote } = useQuoteMutation()

  const updateField = async (patch: UpdateOpportunityInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const opportunity = opportunityQuery.data
  const personQuery = usePerson(opportunity?.personId ?? undefined, {
    enabled: Boolean(opportunity?.personId),
  })
  const organizationQuery = useOrganization(opportunity?.organizationId ?? undefined, {
    enabled: Boolean(opportunity?.organizationId),
  })
  const pipelineQuery = usePipeline(opportunity?.pipelineId, {
    enabled: Boolean(opportunity?.pipelineId),
  })
  const stagesQuery = useStages({
    pipelineId: opportunity?.pipelineId,
    limit: 100,
    enabled: Boolean(opportunity?.pipelineId),
  })
  const activitiesQuery = useActivities({
    entityType: "opportunity",
    entityId: id,
    limit: 50,
    enabled: Boolean(opportunity),
  })
  const quotesQuery = useQuotes({
    opportunityId: id,
    limit: 50,
    enabled: Boolean(opportunity),
  })

  const stages = useMemo(
    () => [...(stagesQuery.data?.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  )
  const activities = activitiesQuery.data?.data ?? []
  const currentStage = stages.find((stage) => stage.id === opportunity?.stageId)
  const person = personQuery.data
  const organization = organizationQuery.data

  if (opportunityQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Opportunity not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/opportunities" })}>
          Back to Opportunities
        </Button>
      </div>
    )
  }

  const currentOpportunity = opportunity

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

  async function createQuoteForOpportunity() {
    const quote = await createQuote.mutateAsync({
      opportunityId: id,
      currency: currentOpportunity.valueCurrency ?? "USD",
    })
    void navigate({ to: "/quotes/$id", params: { id: quote.id } })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/opportunities" })}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => void navigate({ to: "/opportunities" })}
            className="hover:text-foreground"
          >
            Opportunities
          </button>
          <span>/</span>
          <span className="truncate text-foreground">{currentOpportunity.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createQuoteForOpportunity()}
            disabled={createQuote.isPending}
          >
            {createQuote.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            New quote
          </Button>
          {currentOpportunity.status === "open" ? (
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
            title="Delete this opportunity?"
            description="This will permanently remove the opportunity. This action cannot be undone."
            variant="destructive"
            confirmVariant="destructive"
            disabled={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync(id)
              void navigate({ to: "/opportunities" })
            }}
          />
        </div>
      </div>

      {showLostDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-4">
            <CardTitle className="mb-2">Mark opportunity as lost</CardTitle>
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
          <OpportunitySummaryCard
            title={opportunity.title}
            pipelineName={pipelineQuery.data?.name}
            stageName={currentStage?.name}
            status={currentOpportunity.status}
            valueAmountCents={currentOpportunity.valueAmountCents}
            valueCurrency={currentOpportunity.valueCurrency}
            expectedCloseDate={currentOpportunity.expectedCloseDate}
          />
          <OpportunityDetailsCard
            opportunity={currentOpportunity}
            stages={stages}
            onUpdateField={(patch) => updateField(patch as UpdateOpportunityInput)}
          />
          <OpportunityTagsCard
            tags={currentOpportunity.tags}
            onChange={(tags) => updateField({ tags })}
          />
        </aside>

        <main className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <OpportunityParticipantsCard
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
          <OpportunityQuotesCard
            isPending={quotesQuery.isPending}
            quotes={quotesQuery.data?.data ?? []}
            isCreating={createQuote.isPending}
            onCreateQuote={() => {
              void createQuoteForOpportunity()
            }}
            onOpenQuote={(quoteId) => {
              void navigate({ to: "/quotes/$id", params: { id: quoteId } })
            }}
          />
          <OpportunityActivitiesCard
            isPending={activitiesQuery.isPending}
            activities={activities}
          />
        </main>
      </div>
    </div>
  )
}
