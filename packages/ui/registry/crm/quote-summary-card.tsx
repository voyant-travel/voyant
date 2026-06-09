import { TrendingUp } from "lucide-react"

import { Badge, Card, CardContent } from "@/components/ui"

import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import { formatRegistryCrmDate, formatRegistryCrmMoney } from "./i18n/utils"

export function QuoteSummaryCard({
  title,
  pipelineName,
  stageName,
  status,
  valueAmountCents,
  valueCurrency,
  expectedCloseDate,
}: {
  title: string
  pipelineName: string | null | undefined
  stageName: string | null | undefined
  status: string
  valueAmountCents: number | null | undefined
  valueCurrency: string | null
  expectedCloseDate: string | null | undefined
}) {
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const statusLabel =
    m.common.quoteStatusLabels[status as keyof typeof m.common.quoteStatusLabels] ?? status

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pipelineName ?? m.quoteSummaryCard.unknown} -{" "}
              {stageName ?? m.quoteSummaryCard.unknown}
            </p>
          </div>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-semibold">
            {formatRegistryCrmMoney(i18n, valueAmountCents, valueCurrency)}
          </span>
        </div>
        {expectedCloseDate ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {m.quoteSummaryCard.expectedClose}: {formatRegistryCrmDate(i18n, expectedCloseDate)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
