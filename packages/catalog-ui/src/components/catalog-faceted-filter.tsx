"use client"

import type { CatalogFacetBucket } from "@voyantjs/catalog-react"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@voyantjs/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { PlusCircle } from "lucide-react"

export interface CatalogFacetedFilterProps {
  /** Field name (matches the indexer document field). */
  field: string
  /** Display label for the filter trigger. */
  label: string
  /** Live facet buckets — values + counts from the search response. */
  buckets: CatalogFacetBucket[]
  /** Currently-selected values for this field. */
  selected: Array<string | number>
  /** Toggle a value on/off. */
  onToggle: (value: string | number) => void
  /** Clear all selections for this field. */
  onClear: () => void
  /**
   * Optional value formatter. Used to display human-readable labels for
   * fields that store IDs — e.g. `lineSupplierId` resolved against a
   * `Map<id, name>`. Falls back to `String(value)` when not provided.
   */
  formatValue?: (value: string | number) => string
}

/**
 * Faceted filter dropdown — modeled after shadcn's data-table-faceted-filter.
 * Renders as a dashed-border button showing the field label and any active
 * selections as compact badges. Opens a searchable command list with
 * checkbox-style selection per bucket; counts come from the live facet
 * response so the UI never lies about what's available.
 */
export function CatalogFacetedFilter({
  label,
  buckets,
  selected,
  onToggle,
  onClear,
  formatValue,
}: CatalogFacetedFilterProps) {
  const selectedSet = new Set(selected)
  const display = (v: string | number) => (formatValue ? formatValue(v) : String(v))

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-8 gap-2 border-dashed" />}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="-mr-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">
            {selected.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {buckets.map((bucket) => {
                const isSelected = selectedSet.has(bucket.value)
                return (
                  <CommandItem key={String(bucket.value)} onSelect={() => onToggle(bucket.value)}>
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      aria-hidden
                      className="mr-2 pointer-events-none"
                    />
                    <span className="flex-1 truncate capitalize">{display(bucket.value)}</span>
                    <span className="ml-2 text-muted-foreground text-xs">{bucket.count}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={onClear}
                    className="justify-center text-center text-muted-foreground"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
