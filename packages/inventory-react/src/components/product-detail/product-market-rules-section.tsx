"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirmDialog,
} from "@voyant-travel/ui/components"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Globe2, Loader2, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  type MarketProductRuleRecord,
  useMarketProductRuleMutation,
  useMarketProductRules,
  useMarkets,
} from "./commerce-client.js"

import { useProductDetailMessages } from "./host.js"

type MarketRulesMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["marketRules"]

const SELLABILITY = ["sellable", "on_request", "unavailable"] as const
const VISIBILITY = ["public", "private", "hidden"] as const

type Sellability = (typeof SELLABILITY)[number]
type Visibility = (typeof VISIBILITY)[number]

interface ProductMarketRulesSectionProps {
  productId: string
}

export function ProductMarketRulesSection({ productId }: ProductMarketRulesSectionProps) {
  const t = useProductDetailMessages().products.operations.marketRules
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
      toast.error(error instanceof Error ? error.message : t.addFailed)
    }
  }

  const updateRule = async (
    rule: MarketProductRuleRecord,
    input: Partial<Pick<MarketProductRuleRecord, "sellability" | "visibility" | "active">>,
  ) => {
    try {
      await mutations.update.mutateAsync({ id: rule.id, input })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.updateFailed)
    }
  }

  const removeRule = async (rule: MarketProductRuleRecord) => {
    const marketName = marketById.get(rule.marketId)?.name ?? rule.marketId
    if (
      !(await confirmDialog({
        description: formatMessage(t.removeConfirm, { market: marketName }),
        destructive: true,
      }))
    )
      return
    try {
      await mutations.remove.mutateAsync(rule.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.removeFailed)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              {t.title}
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">{t.description}</p>
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
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t.addMarketPlaceholder} />
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
            {t.addMarketButton}
          </Button>
        </div>

        {productRules.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
            {t.empty}
          </div>
        ) : (
          <div className="rounded-md border">
            <div className="hidden gap-3 border-b px-3 py-2 text-muted-foreground text-xs font-medium md:grid md:grid-cols-[minmax(0,1fr)_160px_150px_130px_40px] md:items-center">
              <span />
              <span>{t.sellabilityLabel}</span>
              <span>{t.visibilityLabel}</span>
              <span>{t.statusLabel}</span>
              <span />
            </div>
            <div className="divide-y">
              {productRules.map((rule) => (
                <MarketRuleRow
                  key={rule.id}
                  rule={rule}
                  marketName={marketById.get(rule.marketId)?.name ?? rule.marketId}
                  languageTag={marketById.get(rule.marketId)?.defaultLanguageTag ?? null}
                  disabled={isMutating}
                  onUpdate={updateRule}
                  onRemove={removeRule}
                  messages={t}
                />
              ))}
            </div>
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
  messages: MarketRulesMessages
}

function MarketRuleRow({
  rule,
  marketName,
  languageTag,
  disabled,
  onUpdate,
  onRemove,
  messages,
}: MarketRuleRowProps) {
  return (
    <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_160px_150px_130px_40px] md:items-center">
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{marketName}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {languageTag ? <Badge variant="secondary">{languageTag}</Badge> : null}
          <Badge variant={rule.active ? "default" : "outline"}>
            {rule.active ? messages.activeBadge : messages.inactiveBadge}
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
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SELLABILITY.map((value) => (
            <SelectItem key={value} value={value}>
              {messages.sellabilityOptions[value]}
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
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY.map((value) => (
            <SelectItem key={value} value={value}>
              {messages.visibilityOptions[value]}
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
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">{messages.activeStatus}</SelectItem>
          <SelectItem value="inactive">{messages.inactiveStatus}</SelectItem>
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
