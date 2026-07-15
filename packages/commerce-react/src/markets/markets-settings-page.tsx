"use client"

import { Button, Card, CardContent } from "@voyant-travel/ui/components"
import { Plus } from "lucide-react"
import { useState } from "react"

import { MarketDialog } from "./components/market-dialog.js"
import { useMarketsUiMessagesOrDefault } from "./i18n/index.js"
import { useMarkets } from "./index.js"

export function MarketsSettingsPage() {
  const messages = useMarketsUiMessagesOrDefault().settingsPage
  const markets = useMarkets({ limit: 100 })
  const [open, setOpen] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{messages.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.description}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {messages.add}
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {(markets.data?.data ?? []).map((market) => (
          <Card key={market.id} className="rounded-md shadow-none">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{market.name}</p>
                <p className="text-sm text-muted-foreground">
                  {market.defaultLanguageTag} / {market.defaultCurrency}
                </p>
              </div>
              <span className="text-xs uppercase text-muted-foreground">{market.code}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      {!markets.isPending && (markets.data?.data.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{messages.empty}</p>
      ) : null}
      <MarketDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
