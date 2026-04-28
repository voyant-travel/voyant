import { type PropertyRecord, useProperties, useProperty } from "@voyantjs/facilities-react"
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

type Props = {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

const PAGE_SIZE = 25

function propertyLabel(property: PropertyRecord) {
  return property.brandName || property.id
}

export function PropertyCombobox({
  value,
  onChange,
  placeholder = "Search properties…",
  disabled,
}: Props) {
  const [search, setSearch] = React.useState("")
  const listQuery = useProperties({ search: search || undefined, limit: PAGE_SIZE })
  const selectedQuery = useProperty(value ?? undefined, { enabled: !!value })

  const items = React.useMemo(() => {
    const map = new Map<string, PropertyRecord>()
    for (const item of listQuery.data?.data ?? []) map.set(item.id, item)
    if (selectedQuery.data) map.set(selectedQuery.data.id, selectedQuery.data)
    return Array.from(map.values())
  }, [listQuery.data?.data, selectedQuery.data])

  const itemMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const selected = value ? itemMap.get(value) : undefined
  const selectedLabel = selected ? propertyLabel(selected) : ""
  const [inputValue, setInputValue] = React.useState(selectedLabel)

  React.useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={items.map((item) => item.id)}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringValue={(id) => {
        const item = itemMap.get(id as string)
        return item ? propertyLabel(item) : ""
      }}
      onInputValueChange={(next) => {
        setInputValue(next)
        setSearch(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const id = (next as string | null) ?? null
        onChange(id)
        const item = id ? itemMap.get(id) : null
        setInputValue(item ? propertyLabel(item) : "")
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} />
      <ComboboxContent>
        <ComboboxEmpty>
          {listQuery.isPending || selectedQuery.isPending ? "Loading…" : "No properties found."}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const item = itemMap.get(id as string)
              if (!item) return null
              return (
                <ComboboxItem key={item.id} value={item.id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.brandName || item.id}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[item.propertyType, item.groupName].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </ComboboxItem>
              )
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
