"use client"

import {
  type MarketProductRuleRecord,
  useMarketProductRuleMutation,
  useMarketProductRules,
  useMarkets,
} from "@voyantjs/markets-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Globe2, Loader2, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

const SELLABILITY = ["sellable", "on_request", "unavailable"] as const
const VISIBILITY = ["public", "private", "hidden"] as const

type Sellability = (typeof SELLABILITY)[number]
type Visibility = (typeof VISIBILITY)[number]

interface ProductMarketRulesSectionProps {
  productId: string
}

export function ProductMarketRulesSection({ productId }: ProductMarketRulesSectionProps) {
  const marketsQuery = useMarkets({ status: "active", limit: 100 })
  const rulesQuery = useMarketProductRules({ productId, limit: 200 })
  const mutations = useMarketProductRuleMutation()
  const markets = marketsQuery.data?.data ?? []
  const productRules = (rulesQuery.data?.data ?? []).filter((rule) => !rule.optionId)
  const marketById = useMemo(() => new Map(markets.map((market) => [market.id, market])), [markets])
  const existingMarketIds = new Set(productRules.map((rule) => rule.marketId))
  const availableMarkets = markets.filter((market) => !existingMarketIds.has(market.id))
  const [selectedMarketId, setSelectedMarketId] = useState("")
  const isLoading = marketsQuery.isPending || rulesQuery.isPending
  const isMutating =
    mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending

  const addRule = async () => {
    if (!selectedMarketId) return
    try {
      await mutations.create.mutateAsync({
        marketId: selectedMarketId,
        productId,
        optionId: null,
        priceCatalogId: null,
        visibility: "public",
        sellability: "sellable",
        channelScope: "all",
        active: true,
        availableFrom: null,
        availableTo: null,
        notes: null,
      })
      setSelectedMarketId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add market rule.")
    }
  }

  const updateRule = async (
    rule: MarketProductRuleRecord,
    input: Partial<Pick<MarketProductRuleRecord, "sellability" | "visibility" | "active">>,
  ) => {
    try {
      await mutations.update.mutateAsync({ id: rule.id, input })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update market rule.")
    }
  }

  const removeRule = async (rule: MarketProductRuleRecord) => {
    const marketName = marketById.get(rule.marketId)?.name ?? rule.marketId
    if (!confirm(`Remove ${marketName} from this product?`)) return
    try {
      await mutations.remove.mutateAsync(rule.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove market rule.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Markets
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              Product-level market availability, visibility, and sellability.
            </p>
          </div>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select
            value={selectedMarketId}
            onValueChange={(value) => setSelectedMarketId(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Add market" />
            </SelectTrigger>
            <SelectContent>
              {availableMarkets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  {market.name} · {market.defaultLanguageTag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => void addRule()}
            disabled={!selectedMarketId || isMutating}
          >
            {mutations.create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Market
          </Button>
        </div>

        {productRules.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
            No market rules yet. Without a rule, the product follows global market defaults.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {productRules.map((rule) => (
              <MarketRuleRow
                key={rule.id}
                rule={rule}
                marketName={marketById.get(rule.marketId)?.name ?? rule.marketId}
                languageTag={marketById.get(rule.marketId)?.defaultLanguageTag ?? null}
                disabled={isMutating}
                onUpdate={updateRule}
                onRemove={removeRule}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface MarketRuleRowProps {
  rule: MarketProductRuleRecord
  marketName: string
  languageTag: string | null
  disabled: boolean
  onUpdate: (
    rule: MarketProductRuleRecord,
    input: Partial<Pick<MarketProductRuleRecord, "sellability" | "visibility" | "active">>,
  ) => void
  onRemove: (rule: MarketProductRuleRecord) => void
}

function MarketRuleRow({
  rule,
  marketName,
  languageTag,
  disabled,
  onUpdate,
  onRemove,
}: MarketRuleRowProps) {
  return (
    <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_150px_140px_110px_auto] md:items-center">
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{marketName}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {languageTag ? <Badge variant="secondary">{languageTag}</Badge> : null}
          <Badge variant={rule.active ? "default" : "outline"}>
            {rule.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
      <Select
        value={rule.sellability}
        onValueChange={(value) => {
          if (value) onUpdate(rule, { sellability: value as Sellability })
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SELLABILITY.map((value) => (
            <SelectItem key={value} value={value}>
              {formatToken(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={rule.visibility}
        onValueChange={(value) => {
          if (value) onUpdate(rule, { visibility: value as Visibility })
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY.map((value) => (
            <SelectItem key={value} value={value}>
              {formatToken(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={rule.active ? "active" : "inactive"}
        onValueChange={(value) => {
          if (value) onUpdate(rule, { active: value === "active" })
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(rule)}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
