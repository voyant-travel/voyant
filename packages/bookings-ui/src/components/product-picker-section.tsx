"use client"

import { useProductOptions, useProducts } from "@voyantjs/products-react"
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider"

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
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.productPickerSection.labels, ...labels }

  const { data: productsData } = useProducts({
    search: productSearch || undefined,
    limit: 20,
    enabled: enabled && !lockProduct,
  })
  const products = productsData?.data ?? []

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
          <Input
            placeholder={merged.productSearchPlaceholder}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          <Select
            items={products.map((p) => ({ label: p.name, value: p.id }))}
            value={value.productId}
            onValueChange={(v) => onChange({ productId: v ?? "", optionId: null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={merged.productSelectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
