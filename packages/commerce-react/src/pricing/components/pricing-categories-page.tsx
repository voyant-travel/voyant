"use client"

import { cn } from "@voyant-travel/ui/lib/utils"
import { usePricingUiMessagesOrDefault } from "../i18n/index.js"
import { PricingCategoryList, type PricingCategoryListProps } from "./pricing-category-list.js"

export interface PricingCategoriesPageProps {
  pageSize?: PricingCategoryListProps["pageSize"]
  className?: string
}

export function PricingCategoriesPage({ pageSize, className }: PricingCategoriesPageProps = {}) {
  const messages = usePricingUiMessagesOrDefault().pricingCategoriesPage

  return (
    <div data-slot="pricing-categories-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{messages.title}</h2>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <PricingCategoryList pageSize={pageSize} />
    </div>
  )
}
