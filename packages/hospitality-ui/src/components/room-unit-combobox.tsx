import { type RoomUnitRecord, useRoomUnit, useRoomUnits } from "@voyantjs/hospitality-react"
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

import { useHospitalityUiMessagesOrDefault } from "../i18n"

type Props = {
  propertyId: string
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

const PAGE_SIZE = 25

export function RoomUnitCombobox({ propertyId, value, onChange, placeholder, disabled }: Props) {
  const messages = useHospitalityUiMessagesOrDefault()
  const [search, setSearch] = React.useState("")
  const listQuery = useRoomUnits({
    propertyId,
    search: search || undefined,
    limit: PAGE_SIZE,
    enabled: !!propertyId,
  })
  const selectedQuery = useRoomUnit(value, { enabled: !!value })
  const items = React.useMemo(() => {
    const map = new Map<string, RoomUnitRecord>()
    for (const item of listQuery.data?.data ?? []) map.set(item.id, item)
    if (selectedQuery.data) map.set(selectedQuery.data.id, selectedQuery.data)
    return Array.from(map.values())
  }, [listQuery.data?.data, selectedQuery.data])
  const itemMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const selected = value ? itemMap.get(value) : undefined
  const selectedLabel = selected ? (selected.roomNumber ?? selected.code ?? selected.id) : ""
  const [inputValue, setInputValue] = React.useState(selectedLabel)

  React.useEffect(() => {
    if (selectedLabel) setInputValue(selectedLabel)
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
        return item ? (item.roomNumber ?? item.code ?? item.id) : ""
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
        setInputValue(item ? (item.roomNumber ?? item.code ?? item.id) : "")
      }}
    >
      <ComboboxInput
        placeholder={placeholder ?? messages.comboboxes.roomUnit.placeholder}
        showClear={!!value}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {listQuery.isPending || selectedQuery.isPending
            ? messages.common.loading
            : messages.comboboxes.roomUnit.empty}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const item = itemMap.get(id as string)
              if (!item) return null
              return (
                <ComboboxItem key={item.id} value={item.id}>
                  {item.roomNumber ?? item.code ?? item.id}
                </ComboboxItem>
              )
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
