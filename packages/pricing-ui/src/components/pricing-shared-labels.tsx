"use client"

import {
  useCancellationPolicy,
  useOptionPriceRule,
  usePriceCatalog,
  usePriceSchedule,
  usePricingCategory,
} from "@voyantjs/pricing-react"
import { useProduct, useProductOption } from "@voyantjs/products-react"

export function PriceCatalogLabel({ id }: { id: string }) {
  const query = usePriceCatalog(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function PriceScheduleLabel({ id }: { id: string }) {
  const query = usePriceSchedule(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function CancellationPolicyLabel({ id }: { id: string }) {
  const query = useCancellationPolicy(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function ProductLabel({ id }: { id: string }) {
  const query = useProduct(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function ProductOptionLabel({ id }: { id: string }) {
  const query = useProductOption(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function OptionPriceRuleLabel({ id }: { id: string }) {
  const query = useOptionPriceRule(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}

export function PricingCategoryLabel({ id }: { id: string }) {
  const query = usePricingCategory(id, { enabled: !!id })
  return <span className="text-muted-foreground">{query.data?.name ?? id}</span>
}
