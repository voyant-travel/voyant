"use client"

import { cn } from "@voyant-travel/ui/lib/utils"
import { useProductsUiMessagesOrDefault } from "../i18n/index.js"
import { ProductTagList, type ProductTagListProps } from "./product-tag-list.js"

export interface ProductTagsPageProps {
  pageSize?: ProductTagListProps["pageSize"]
  className?: string
}

export function ProductTagsPage({ pageSize, className }: ProductTagsPageProps = {}) {
  const messages = useProductsUiMessagesOrDefault().productTagsPage

  return (
    <div data-slot="product-tags-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{messages.title}</h2>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <ProductTagList pageSize={pageSize} />
    </div>
  )
}
