import { ProductCategoryList } from "@voyantjs/products-ui/components/product-category-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function ProductCategoriesPage() {
  const messages = useAdminMessages()
  const categoryMessages = messages.products.taxonomy.categories

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{categoryMessages.pageTitle}</h2>
        <p className="text-sm text-muted-foreground">{categoryMessages.pageDescription}</p>
      </div>

      <ProductCategoryList />
    </div>
  )
}
