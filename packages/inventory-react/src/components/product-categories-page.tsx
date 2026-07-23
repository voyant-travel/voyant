"use client"

import { cn } from "@voyant-travel/ui/lib/utils"
import { useProductsUiMessagesOrDefault } from "../i18n/index.js"
import { ProductCategoryList, type ProductCategoryListProps } from "./product-category-list.js"

export interface ProductCategoriesPageProps {
  pageSize?: ProductCategoryListProps["pageSize"]
  className?: string
}

export function ProductCategoriesPage({ pageSize, className }: ProductCategoriesPageProps = {}) {
  const messages = useProductsUiMessagesOrDefault().productCategoriesPage

  return (
    <div data-slot="product-categories-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{messages.title}</h2>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <ProductCategoryList pageSize={pageSize} />
    </div>
  )
}
