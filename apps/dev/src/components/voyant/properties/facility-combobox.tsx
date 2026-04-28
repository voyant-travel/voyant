import { type FacilityRecord, useFacilities, useFacility } from "@voyantjs/facilities-react"
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
  kind?: string
}

const PAGE_SIZE = 25

function facilityLabel(facility: FacilityRecord) {
  return facility.code ? `${facility.name} (${facility.code})` : facility.name
}

export function FacilityCombobox({
  value,
  onChange,
  placeholder = "Search facilities…",
  disabled,
  kind,
}: Props) {
  const [search, setSearch] = React.useState("")
  const listQuery = useFacilities({ kind, search: search || undefined, limit: PAGE_SIZE })
  const selectedQuery = useFacility(value ?? undefined, { enabled: !!value })

  const items = React.useMemo(() => {
    const map = new Map<string, FacilityRecord>()
    for (const item of listQuery.data?.data ?? []) map.set(item.id, item)
    if (selectedQuery.data) map.set(selectedQuery.data.id, selectedQuery.data)
    return Array.from(map.values())
  }, [listQuery.data?.data, selectedQuery.data])

  const itemMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const selected = value ? itemMap.get(value) : undefined
  const selectedLabel = selected ? facilityLabel(selected) : ""
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
        return item ? facilityLabel(item) : ""
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
        setInputValue(item ? facilityLabel(item) : "")
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} />
      <ComboboxContent>
        <ComboboxEmpty>
          {listQuery.isPending || selectedQuery.isPending ? "Loading…" : "No facilities found."}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const item = itemMap.get(id as string)
              if (!item) return null
              return (
                <ComboboxItem key={item.id} value={item.id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[item.code, item.city].filter(Boolean).join(" · ") || item.kind}
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
