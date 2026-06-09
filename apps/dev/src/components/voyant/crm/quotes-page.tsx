import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { useNavigate } from "@tanstack/react-router"
import { usePipelines, useQuoteMutation, useQuotes, useStages } from "@voyantjs/crm-react"
import { CreateQuoteDialog } from "@voyantjs/crm-ui/components/create-quote-dialog"
import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Loader2, Plus, Settings2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { CreatePipelineDialog, ManageStagesDialog } from "./pipeline-dialogs"
import { QuotesBoard } from "./quotes-board"

export function QuotesKanbanPage() {
  const navigate = useNavigate()
  const pipelinesQuery = usePipelines({ entityType: "quote", limit: 50 })
  const pipelines = pipelinesQuery.data?.data ?? []
  const defaultPipelineId =
    (pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0])?.id ?? null

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(defaultPipelineId)
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [showManageStages, setShowManageStages] = useState(false)
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPipelineId && defaultPipelineId) {
      setSelectedPipelineId(defaultPipelineId)
      return
    }

    if (selectedPipelineId && !pipelines.some((pipeline) => pipeline.id === selectedPipelineId)) {
      setSelectedPipelineId(defaultPipelineId)
    }
  }, [defaultPipelineId, pipelines, selectedPipelineId])

  const stagesQuery = useStages({
    pipelineId: selectedPipelineId ?? undefined,
    limit: 100,
    enabled: Boolean(selectedPipelineId),
  })
  const quotesQuery = useQuotes({
    pipelineId: selectedPipelineId ?? undefined,
    status: "open",
    limit: 100,
    enabled: Boolean(selectedPipelineId),
  })
  const { update } = useQuoteMutation()

  const stages = useMemo(
    () =>
      [...(stagesQuery.data?.data ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [stagesQuery.data],
  )
  const quotes = quotesQuery.data?.data ?? []
  const activeQuote = activeId ? (quotes.find((quote) => quote.id === activeId) ?? null) : null

  const quotesByStage = useMemo(() => {
    const map = new Map<string, typeof quotes>()
    for (const stage of stages) map.set(stage.id, [])
    for (const quote of quotes) {
      const bucket = map.get(quote.stageId)
      if (bucket) bucket.push(quote)
    }
    return map
  }, [stages, quotes])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const quoteId = String(active.id)
    const newStageId = String(over.id)
    const quote = quotes.find((entry) => entry.id === quoteId)
    if (!quote || quote.stageId === newStageId) return
    try {
      await update.mutateAsync({ id: quoteId, input: { stageId: newStageId } })
    } catch {
      // invalidation restores server state
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between stages to update their status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedPipelineId ?? undefined}
            onValueChange={(value) => setSelectedPipelineId(value)}
            disabled={pipelinesQuery.isPending || pipelines.length === 0}
          >
            <SelectTrigger className="w-[200px] text-sm">
              <SelectValue placeholder="Select pipeline…">
                {(value) => {
                  const pipeline = pipelines.find((entry) => entry.id === value)
                  if (!pipeline) return "Select pipeline…"
                  return `${pipeline.name}${pipeline.isDefault ? " (default)" : ""}`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                  {pipeline.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreatePipeline(true)}
            disabled={pipelinesQuery.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New pipeline
          </Button>
          {selectedPipelineId ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManageStages(true)}
                disabled={stagesQuery.isPending}
              >
                <Settings2 className="mr-1.5 h-4 w-4" />
                Manage stages
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateQuote(true)}
                disabled={stagesQuery.isPending || stages.length === 0}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New quote
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {pipelinesQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pipelines.length === 0 ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">No pipelines configured yet.</p>
          <Button onClick={() => setShowCreatePipeline(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first pipeline
          </Button>
        </Card>
      ) : stagesQuery.isPending || quotesQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stages.length === 0 ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">This pipeline has no stages.</p>
          <Button onClick={() => setShowManageStages(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add first stage
          </Button>
        </Card>
      ) : (
        <QuotesBoard
          stages={stages}
          quotesByStage={quotesByStage}
          activeId={activeId}
          activeQuote={activeQuote}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}

      <CreatePipelineDialog
        open={showCreatePipeline}
        onOpenChange={setShowCreatePipeline}
        existingCount={pipelines.length}
        onCreated={(pipelineId) => {
          setSelectedPipelineId(pipelineId)
          setShowCreatePipeline(false)
          setShowManageStages(true)
        }}
      />

      {selectedPipelineId ? (
        <ManageStagesDialog
          open={showManageStages}
          onOpenChange={setShowManageStages}
          pipelineId={selectedPipelineId}
          stages={stages}
        />
      ) : null}

      {selectedPipelineId && stages.length > 0 ? (
        <CreateQuoteDialog
          open={showCreateQuote}
          onOpenChange={setShowCreateQuote}
          pipelineId={selectedPipelineId}
          stages={stages}
          onCreated={(id) => {
            setShowCreateQuote(false)
            void navigate({ to: "/quotes/$id", params: { id } })
          }}
        />
      ) : null}
    </div>
  )
}
