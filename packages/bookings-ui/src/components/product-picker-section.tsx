"use client"

import {
  type ProductRecord,
  useProduct,
  useProductOptions,
  useProducts,
} from "@voyantjs/products-react"
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { productMatchesPickerSearch } from "./booking-create-utils.js"

const OPTION_NONE = "__none__"

export interface ProductPickerValue {
  productId: string
  /** `null` means "no specific option" — the product has options but none was picked. */
  optionId: string | null
}

export interface ProductPickerSectionProps {
  value: ProductPickerValue
  onChange: (value: ProductPickerValue) => void
  /** When true, skip data fetches (dialog closed / parent gated). */
  enabled?: boolean
  /** When true, hide the product picker and fix the productId (e.g., launched from a product page). */
  lockProduct?: boolean
  labels?: {
    product?: string
    productSearchPlaceholder?: string
    productSelectPlaceholder?: string
    option?: string
    optionNone?: string
  }
}

/**
 * Controlled product + option picker. Splits `value` + `onChange` so apps can
 * replace the whole section (e.g., with a typeahead against a custom catalog)
 * without reimplementing the cascade logic, or keep this one and swap labels.
 */
export function ProductPickerSection({
  value,
  onChange,
  enabled = true,
  lockProduct = false,
  labels,
}: ProductPickerSectionProps) {
  const [productSearch, setProductSearch] = React.useState("")
  const cachedProductsRef = React.useRef(new Map<string, ProductRecord>())
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.productPickerSection.labels, ...labels }

  const { data: productsData } = useProducts({
    search: productSearch || undefined,
    limit: 20,
    enabled: enabled && !lockProduct,
  })
  const selectedProductQuery = useProduct(value.productId || undefined, {
    enabled: enabled && Boolean(value.productId),
  })

  const products = React.useMemo(() => {
    const map = new Map(cachedProductsRef.current)
    for (const product of productsData?.data ?? []) map.set(product.id, product)
    if (selectedProductQuery.data) map.set(selectedProductQuery.data.id, selectedProductQuery.data)
    cachedProductsRef.current = map
    return Array.from(map.values())
  }, [productsData?.data, selectedProductQuery.data])

  const productMap = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )
  const selectedProductLabel = value.productId ? (productMap.get(value.productId)?.name ?? "") : ""
  const [productInputValue, setProductInputValue] = React.useState(selectedProductLabel)

  React.useEffect(() => {
    if (selectedProductLabel) setProductInputValue(selectedProductLabel)
  }, [selectedProductLabel])

  const { data: optionsData } = useProductOptions({
    productId: value.productId || undefined,
    limit: 50,
    enabled: enabled && Boolean(value.productId),
  })
  const options = optionsData?.data ?? []

  return (
    <>
      {!lockProduct && (
        <div className="flex flex-col gap-2">
          <Label>
            {merged.product} <span className="text-destructive">*</span>
          </Label>
          <Combobox
            items={products.map((product) => product.id)}
            value={value.productId || null}
            inputValue={productInputValue}
            autoHighlight
            disabled={!enabled}
            filter={(id, query) => productMatchesPickerSearch(productMap.get(id as string), query)}
            itemToStringValue={(id) => productMap.get(id as string)?.name ?? ""}
            onInputValueChange={(next) => {
              setProductInputValue(next)
              setProductSearch(next)
              if (!next) onChange({ productId: "", optionId: null })
            }}
            onValueChange={(next) => {
              const productId = (next as string | null) ?? ""
              onChange({ productId, optionId: null })
              setProductInputValue(productId ? (productMap.get(productId)?.name ?? "") : "")
            }}
          >
            <ComboboxInput
              placeholder={merged.productSearchPlaceholder}
              showClear={!!value.productId}
            />
            <ComboboxContent>
              <ComboboxEmpty>{merged.productEmpty}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(id) => {
                    const product = productMap.get(id as string)
                    if (!product) return null
                    return (
                      <ComboboxItem key={product.id} value={product.id}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{product.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {product.sellCurrency}
                            {product.sellAmountCents != null
                              ? ` · ${product.sellAmountCents / 100}`
                              : ""}
                          </span>
                        </div>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}

      {value.productId && options.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>{merged.option}</Label>
          <Select
            items={[
              { label: merged.optionNone, value: OPTION_NONE },
              ...options.map((o) => ({ label: o.name, value: o.id })),
            ]}
            value={value.optionId ?? OPTION_NONE}
            onValueChange={(v) =>
              onChange({
                productId: value.productId,
                optionId: v === OPTION_NONE ? null : (v ?? null),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OPTION_NONE}>{merged.optionNone}</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
