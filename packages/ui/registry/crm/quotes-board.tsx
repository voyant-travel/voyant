import type { QuoteRecord as QuoteData, StageRecord as StageData } from "@voyantjs/crm-react"
import { TrendingUp } from "lucide-react"

import { Card } from "@/components/ui"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import { formatRegistryCrmDate, formatRegistryCrmMoney } from "./i18n/utils"

export function QuotesBoard({
  stages,
  quotesByStage,
}: {
  stages: StageData[]
  quotesByStage: Map<string, QuoteData[]>
}) {
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()

  return (
    <ScrollArea className="flex-1">
      <div className="flex gap-3 pb-2">
        {stages.map((stage) => {
          const quotes = quotesByStage.get(stage.id) ?? []
          const total = quotes.reduce((sum, quote) => sum + (quote.valueAmountCents ?? 0), 0)
          const primaryCurrency = quotes[0]?.valueCurrency ?? null

          return (
            <div
              key={stage.id}
              className="flex w-[280px] min-w-[280px] flex-col gap-2 rounded-md border bg-muted/30 p-2"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {stage.name || m.quotesBoard.fallbackName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i18n.formatNumber(quotes.length)} -{" "}
                    {formatRegistryCrmMoney(i18n, total, primaryCurrency)}
                  </p>
                </div>
                {stage.probability != null ? (
                  <span className="rounded border px-1.5 py-0.5 text-[10px]">
                    {i18n.formatNumber(stage.probability)}%
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="p-3 text-sm">
                    <p className="line-clamp-2 font-medium">{quote.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {formatRegistryCrmMoney(i18n, quote.valueAmountCents, quote.valueCurrency)}
                      </span>
                      {quote.expectedCloseDate ? (
                        <span className="text-xs text-muted-foreground">
                          {formatRegistryCrmDate(i18n, quote.expectedCloseDate)}
                        </span>
                      ) : null}
                    </div>
                  </Card>
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
