import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { QuoteRecord as QuoteData, StageRecord as StageData } from "@voyantjs/crm-react"
import { Card } from "@voyantjs/ui/components"
import { ScrollArea, ScrollBar } from "@voyantjs/ui/components/scroll-area"
import { cn } from "@voyantjs/ui/lib/utils"
import { TrendingUp } from "lucide-react"
import { formatDate, formatMoney } from "@/components/voyant/crm/crm-constants"

export function QuotesBoard({
  stages,
  quotesByStage,
  activeId,
  activeQuote,
  onDragStart,
  onDragEnd,
}: {
  stages: StageData[]
  quotesByStage: Map<string, QuoteData[]>
  activeId: string | null
  activeQuote: QuoteData | null
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <ScrollArea className="flex-1">
        <div className="flex gap-3 pb-2">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              quotes={quotesByStage.get(stage.id) ?? []}
              activeId={activeId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>{activeQuote ? <QuoteCard opp={activeQuote} isDragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  stage,
  quotes,
  activeId,
}: {
  stage: StageData
  quotes: QuoteData[]
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = quotes.reduce((sum, quote) => sum + (quote.valueAmountCents ?? 0), 0)
  const primaryCurrency = quotes[0]?.valueCurrency ?? null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] min-w-[280px] flex-col gap-2 rounded-md border bg-muted/30 p-2 transition-colors",
        isOver && "border-primary bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{stage.name}</p>
          <p className="text-xs text-muted-foreground">
            {quotes.length} · {formatMoney(total, primaryCurrency)}
          </p>
        </div>
        {stage.probability != null ? (
          <span className="rounded border px-1.5 py-0.5 text-[10px]">{stage.probability}%</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {quotes.map((quote) => (
          <DraggableQuote key={quote.id} opp={quote} isActive={activeId === quote.id} />
        ))}
      </div>
    </div>
  )
}

function DraggableQuote({ opp, isActive }: { opp: QuoteData; isActive: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: opp.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing", isActive && "opacity-40")}
    >
      <QuoteCard opp={opp} />
    </div>
  )
}

export function QuoteCard({ opp, isDragging }: { opp: QuoteData; isDragging?: boolean }) {
  return (
    <Card className={cn("p-3 text-sm", isDragging && "rotate-2 shadow-lg")}>
      <p className="line-clamp-2 font-medium">{opp.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          {formatMoney(opp.valueAmountCents, opp.valueCurrency)}
        </span>
        {opp.expectedCloseDate ? (
          <span className="text-xs text-muted-foreground">{formatDate(opp.expectedCloseDate)}</span>
        ) : null}
      </div>
    </Card>
  )
}
