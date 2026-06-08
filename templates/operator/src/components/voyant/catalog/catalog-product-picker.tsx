"use client"

import { type ProductPickerRenderProps, ProductPickerSection } from "@voyantjs/bookings-ui"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-ui/i18n"
import { type CatalogSearchHit, useCatalogSearch } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { Label } from "@voyantjs/ui/components/label"
import { useMemo, useState } from "react"

/**
 * Catalog-aware product picker for "New booking" — a single typeahead
 * spanning OWNED + supplier-SOURCED products (catalog search index), so
 * operators never learn an owned-vs-sourced split. Owned picks report via
 * `onChange`; sourced picks report via `onSourcedSelected` (they carry
 * supplier provenance). The host decides where each goes.
 *
 * The operator route uses this standalone and routes BOTH owned and sourced
 * selections into the unified booking journey. It also satisfies
 * `ProductPickerRenderProps`, so it can still drop into the create-sheet's
 * `renderProductPicker` slot (where owned stays inline and only sourced
 * hands off to the journey).
 */

export interface SourcedProductSelection {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceRef?: string
  sourceConnectionId?: string
  name?: string
}

export interface CatalogProductPickerProps extends ProductPickerRenderProps {
  /** A supplier-sourced product was picked — host hands off to the booking journey. */
  onSourcedSelected: (selection: SourcedProductSelection) => void
}

function hitField(hit: CatalogSearchHit | undefined, key: string): string | undefined {
  if (!hit) return undefined
  const v = hit.document.fields[key]
  return typeof v === "string" && v.length > 0 ? v : undefined
}

export function CatalogProductPicker({
  value,
  onChange,
  enabled,
  lockProduct,
  onSourcedSelected,
}: CatalogProductPickerProps) {
  // Launched from a product page (locked) → always an owned product; keep the
  // fast owned picker rather than a catalog search.
  if (lockProduct) {
    return (
      <ProductPickerSection
        value={value}
        onChange={onChange}
        enabled={enabled}
        lockProduct
        showOptionPicker={false}
      />
    )
  }
  return (
    <CatalogTypeahead
      value={value}
      onChange={onChange}
      enabled={enabled}
      onSourcedSelected={onSourcedSelected}
    />
  )
}

function CatalogTypeahead({
  value,
  onChange,
  enabled,
  onSourcedSelected,
}: Omit<CatalogProductPickerProps, "lockProduct">) {
  const labels = useBookingsUiMessagesOrDefault().productPickerSection.labels
  const [search, setSearch] = useState("")
  const [inputValue, setInputValue] = useState("")

  const query = useCatalogSearch({
    vertical: "products",
    query: search,
    surface: "admin",
    pagination: { limit: 12 },
    enabled: enabled && search.trim().length > 0,
  })
  const hits = query.data?.hits ?? []
  const hitMap = useMemo(() => new Map(hits.map((h) => [h.id, h])), [hits])

  return (
    <div className="flex flex-col gap-2">
      <Label>
        {labels.product} <span className="text-destructive">*</span>
      </Label>
      <Combobox
        items={hits.map((h) => h.id)}
        value={value.productId || null}
        inputValue={inputValue}
        autoHighlight
        disabled={!enabled}
        // Search is server-side (Typesense); never client-filter the results.
        filter={() => true}
        itemToStringLabel={(id) => hitField(hitMap.get(id as string), "name") ?? (id as string)}
        itemToStringValue={(id) => id as string}
        onInputValueChange={(next) => {
          setInputValue(next)
          setSearch(next)
          if (!next) onChange({ productId: "", optionId: null })
        }}
        onValueChange={(next) => {
          const id = (next as string | null) ?? ""
          if (!id) {
            onChange({ productId: "", optionId: null })
            setInputValue("")
            return
          }
          const hit = hitMap.get(id)
          const sourceKind = hitField(hit, "source.kind") ?? "owned"
          const name = hitField(hit, "name")
          if (sourceKind === "owned") {
            onChange({ productId: id, optionId: null })
            setInputValue(name ?? id)
          } else {
            // Sourced — the owned-only create-sheet can't load this id; hand off
            // to the unified booking journey (live quote/lock).
            onSourcedSelected({
              entityModule: "products",
              entityId: id,
              sourceKind,
              sourceRef: hitField(hit, "source.ref"),
              sourceConnectionId: hitField(hit, "source.connectionId"),
              name,
            })
            setInputValue("")
          }
        }}
      >
        <ComboboxInput
          placeholder={labels.productSearchPlaceholder}
          showClear={!!value.productId}
        />
        <ComboboxContent>
          <ComboboxEmpty>{labels.productEmpty}</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(id) => {
                const hit = hitMap.get(id as string)
                if (!hit) return null
                const name = hitField(hit, "name") ?? hit.id
                const owned = (hitField(hit, "source.kind") ?? "owned") === "owned"
                return (
                  <ComboboxItem key={hit.id} value={hit.id}>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate font-medium">{name}</span>
                      <Badge
                        variant={owned ? "secondary" : "outline"}
                        className="shrink-0 font-normal"
                      >
                        {owned ? labels.owned : labels.supplier}
                      </Badge>
                    </div>
                  </ComboboxItem>
                )
              }}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
