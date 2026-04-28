import { PricingCategoryList } from "@voyantjs/pricing-ui/components/pricing-category-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function PricingCategoriesPage() {
  const messages = useAdminMessages()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {messages.settings.pricingCategoriesPage.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {messages.settings.pricingCategoriesPage.description}
        </p>
      </div>

      <PricingCategoryList />
    </div>
  )
}
