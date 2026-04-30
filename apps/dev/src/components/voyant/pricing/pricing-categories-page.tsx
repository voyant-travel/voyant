import { PricingCategoryList } from "@voyantjs/pricing-ui/components/pricing-category-list"

export function PricingCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Pricing Categories</h2>
        <p className="text-sm text-muted-foreground">
          Global categories like adult, child, and room reused across your pricing rules.
        </p>
      </div>

      <PricingCategoryList />
    </div>
  )
}
