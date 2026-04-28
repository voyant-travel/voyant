import { ProductTagList } from "@voyantjs/products-ui/components/product-tag-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function ProductTagsPage() {
  const messages = useAdminMessages()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {messages.settings.productTagsPage.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {messages.settings.productTagsPage.description}
        </p>
      </div>

      <ProductTagList />
    </div>
  )
}
