import type {
  OpportunityRecord as OpportunityData,
  StageRecord as StageData,
} from "@voyantjs/crm-react"
import { Card } from "@voyantjs/ui/components"
import { ScrollArea, ScrollBar } from "@voyantjs/ui/components/scroll-area"
import { TrendingUp } from "lucide-react"

import { useCrmUiI18nOrDefault } from "../i18n/index.js"
import { formatCrmDate, formatCrmMoney } from "./crm-format.js"

export interface OpportunitiesBoardProps {
  stages: StageData[]
  opportunitiesByStage: Map<string, OpportunityData[]>
  onOpportunityOpen?: (opportunity: OpportunityData) => void
}

export function OpportunitiesBoard({
  stages,
  opportunitiesByStage,
  onOpportunityOpen,
}: OpportunitiesBoardProps) {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n

  return (
    <ScrollArea className="flex-1">
      <div className="flex gap-3 pb-2">
        {stages.map((stage) => {
          const opportunities = opportunitiesByStage.get(stage.id) ?? []
          const total = opportunities.reduce(
            (sum, opportunity) => sum + (opportunity.valueAmountCents ?? 0),
            0,
          )
          const primaryCurrency = opportunities[0]?.valueCurrency ?? null

          return (
            <div
              key={stage.id}
              className="flex w-[280px] min-w-[280px] flex-col gap-2 rounded-md border bg-muted/30 p-2"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {stage.name || messages.opportunitiesBoard.fallbackName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i18n.formatNumber(opportunities.length)} -{" "}
                    {formatCrmMoney(i18n, total, primaryCurrency)}
                  </p>
                </div>
                {stage.probability != null ? (
                  <span className="rounded border px-1.5 py-0.5 text-[10px]">
                    {i18n.formatNumber(stage.probability)}%
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {opportunities.map((opportunity) => (
                  <OpportunityBoardCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onOpen={onOpportunityOpen}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

function OpportunityBoardCard({
  opportunity,
  onOpen,
}: {
  opportunity: OpportunityData
  onOpen?: (opportunity: OpportunityData) => void
}) {
  const i18n = useCrmUiI18nOrDefault()
  const content = (
    <>
      <p className="line-clamp-2 font-medium">{opportunity.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="size-3" aria-hidden="true" />
          {formatCrmMoney(i18n, opportunity.valueAmountCents, opportunity.valueCurrency)}
        </span>
        {opportunity.expectedCloseDate ? (
          <span className="text-xs text-muted-foreground">
            {formatCrmDate(i18n, opportunity.expectedCloseDate)}
          </span>
        ) : null}
      </div>
    </>
  )

  if (onOpen) {
    return (
      <Card className="p-3 text-sm">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => onOpen(opportunity)}
        >
          {content}
        </button>
      </Card>
    )
  }

  return <Card className="p-3 text-sm">{content}</Card>
}
