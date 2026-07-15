import { useQuery } from "@tanstack/react-query"
import { DropdownMenuItem, ToggleGroup, ToggleGroupItem } from "@voyant-travel/ui/components"
import { Pencil } from "lucide-react"
import { useEffect, useState } from "react"
import { useProductTranslations } from "../../index.js"
import { type ProductDetailApi, useProductDetailApi, useProductDetailMessages } from "./host.js"
import {
  resolveProductDetailBaseLanguageToggleTag,
  resolveProductDetailDescription,
  resolveProductDetailSelectedLanguageTag,
} from "./product-detail-language.js"
import { ActionMenu, DetailRow, Section } from "./product-detail-section-shell.js"
import { formatAmount, type ProductRecord } from "./product-detail-shared.js"

type OptionPriceRuleSummary = {
  id: string
  active: boolean
}

type OptionUnitPriceRuleSummary = {
  sellAmountCents: number | null
  active: boolean
}

async function getProductStartingFromCents(
  api: ProductDetailApi,
  productId: string,
): Promise<number | null> {
  const rules = await api.get<{ data: OptionPriceRuleSummary[] }>(
    `/v1/admin/pricing/option-price-rules?productId=${encodeURIComponent(productId)}&limit=100&active=true`,
  )
  const ruleIds = rules.data.filter((rule) => rule.active).map((rule) => rule.id)
  if (ruleIds.length === 0) return null

  const unitPriceResponses = await Promise.all(
    ruleIds.map((ruleId) =>
      api.get<{ data: OptionUnitPriceRuleSummary[] }>(
        `/v1/admin/pricing/option-unit-price-rules?optionPriceRuleId=${encodeURIComponent(ruleId)}&limit=100&active=true`,
      ),
    ),
  )
  const prices = unitPriceResponses
    .flatMap((response) => response.data)
    .filter((rule) => rule.active)
    .map((rule) => rule.sellAmountCents)
    .filter((amount): amount is number => amount != null && amount > 0)

  return prices.length > 0 ? Math.min(...prices) : null
}

// Legacy CMS imports occasionally store rich HTML in the plain-text description
// field. Detect it so we can render it as markup instead of dumping raw tags.
function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function ProductDetailsSection({
  product,
  onEdit,
}: {
  product: ProductRecord
  onEdit: () => void
}) {
  const api = useProductDetailApi()
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const startingFromQuery = useQuery({
    queryKey: ["product-starting-from", product.id],
    queryFn: () => getProductStartingFromCents(api, product.id),
  })
  const startingFromCents = startingFromQuery.data ?? null
  const usesOptionUnitPricing = startingFromQuery.isPending || startingFromCents != null

  const translationsQuery = useProductTranslations(product.id, { limit: 100 })
  const translations = translationsQuery.data?.data ?? []
  const [selectedLanguageTag, setSelectedLanguageTag] = useState("")
  const baseLanguageTag = resolveProductDetailBaseLanguageToggleTag({
    defaultLanguageTag: product.defaultLanguageTag,
    translations,
  })

  // Read mode starts on the product's default/base language. Non-default
  // translations render only after an explicit language toggle selection.
  useEffect(() => {
    const nextLanguageTag = resolveProductDetailSelectedLanguageTag({
      defaultLanguageTag: product.defaultLanguageTag,
      selectedLanguageTag,
      translations,
    })
    if (nextLanguageTag !== selectedLanguageTag) setSelectedLanguageTag(nextLanguageTag)
  }, [translations, selectedLanguageTag, product.defaultLanguageTag])

  const description = resolveProductDetailDescription({
    defaultLanguageTag: product.defaultLanguageTag,
    productDescription: product.description,
    selectedLanguageTag,
    translations,
  })

  return (
    <Section
      title={productMessages.detailsTitle}
      actions={
        <div className="flex items-center gap-2">
          {translations.length > 0 || baseLanguageTag ? (
            <ToggleGroup
              value={selectedLanguageTag ? [selectedLanguageTag] : []}
              onValueChange={(values) => {
                const next = values[values.length - 1]
                if (next) setSelectedLanguageTag(next)
              }}
              variant="outline"
              size="sm"
              aria-label={productMessages.descriptionLanguageLabel}
            >
              {baseLanguageTag ? (
                <ToggleGroupItem value={baseLanguageTag} className="px-2 text-xs uppercase">
                  {baseLanguageTag}
                </ToggleGroupItem>
              ) : null}
              {translations.map((translation) => (
                <ToggleGroupItem
                  key={translation.id}
                  value={translation.languageTag}
                  className="px-2 text-xs uppercase"
                >
                  {translation.languageTag}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          <ActionMenu label={`${productMessages.detailsTitle}: ${productMessages.edit}`}>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              {productMessages.edit}
            </DropdownMenuItem>
          </ActionMenu>
        </div>
      }
    >
      {description ? (
        looksLikeHtml(description) ? (
          <div
            className="border-b pb-4 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_em]:italic [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mb-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: operator-authored localized rich text from the products module -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
            dangerouslySetInnerHTML={{ __html: description }}
          />
        ) : (
          <div className="border-b pb-3 text-sm whitespace-pre-line text-muted-foreground">
            {description}
          </div>
        )
      ) : null}
      {usesOptionUnitPricing ? (
        <DetailRow
          label={productMessages.startingFromLabel}
          value={
            <span className="font-mono">
              {startingFromCents != null
                ? formatAmount(startingFromCents, product.sellCurrency)
                : productMessages.noValue}
            </span>
          }
        />
      ) : null}
      {!usesOptionUnitPricing && product.sellAmountCents != null ? (
        <DetailRow
          label={productMessages.sellLabel}
          value={
            <span className="font-mono">
              {formatAmount(product.sellAmountCents, product.sellCurrency)}
            </span>
          }
        />
      ) : null}
      {!usesOptionUnitPricing && product.costAmountCents != null ? (
        <DetailRow
          label={productMessages.costLabel}
          value={
            <span className="font-mono">
              {formatAmount(product.costAmountCents, product.sellCurrency)}
            </span>
          }
        />
      ) : null}
    </Section>
  )
}
