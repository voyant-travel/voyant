import { useQuery } from "@tanstack/react-query"
import * as React from "react"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { api } from "@/lib/api-client"

type ListResponse<T> = { data: T[]; total?: number; limit?: number; offset?: number }

type EntityComboboxProps<T extends { id: string }> = {
  value: string | null | undefined
  onChange: (id: string | null) => void
  endpoint: string
  detailEndpoint?: string | ((id: string) => string)
  queryKey: readonly unknown[]
  getLabel: (item: T) => string
  getSecondary?: (item: T) => string | undefined
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  searchParam?: string
  limit?: number
}

export function EntityCombobox<T extends { id: string }>({
  value,
  onChange,
  endpoint,
  detailEndpoint,
  queryKey,
  getLabel,
  getSecondary,
  placeholder = "Search…",
  emptyText = "No results.",
  disabled,
  searchParam = "search",
  limit = 25,
}: EntityComboboxProps<T>) {
  const [search, setSearch] = React.useState("")

  const buildListEndpoint = React.useCallback(
    (searchValue: string) => {
      const url = new URL(endpoint, "http://local")
      if (searchValue) url.searchParams.set(searchParam, searchValue)
      if (!url.searchParams.has("limit")) url.searchParams.set("limit", String(limit))
      return `${url.pathname}${url.search}`
    },
    [endpoint, limit, searchParam],
  )

  const buildDetailEndpoint = React.useCallback(
    (id: string) => {
      if (typeof detailEndpoint === "function") return detailEndpoint(id)
      if (typeof detailEndpoint === "string") return detailEndpoint.replace(":id", id)
      return null
    },
    [detailEndpoint],
  )

  const { data, isPending } = useQuery({
    queryKey: [...queryKey, "list", search, limit],
    queryFn: () => api.get<ListResponse<T>>(buildListEndpoint(search)),
  })

  const selectedQuery = useQuery({
    queryKey: [...queryKey, "detail", value],
    queryFn: async () => {
      const detail = buildDetailEndpoint(value!)
      if (!detail) throw new Error("EntityCombobox requires detailEndpoint for selected value hydration")
      const response = await api.get<{ data: T }>(detail)
      return response.data
    },
    enabled: !!value && !!buildDetailEndpoint(value),
  })

  const items = React.useMemo(() => {
    const map = new Map<string, T>()
    for (const item of data?.data ?? []) map.set(item.id, item)
    if (selectedQuery.data) map.set(selectedQuery.data.id, selectedQuery.data)
    return Array.from(map.values())
  }, [data?.data, selectedQuery.data])
  const itemIds = React.useMemo(() => items.map((item) => item.id), [items])
  const itemMap = React.useMemo(() => {
    const map = new Map<string, T>()
    for (const item of items) map.set(item.id, item)
    return map
  }, [items])

  const selectedLabel = React.useMemo(() => {
    if (!value) return ""
    const item = itemMap.get(value)
    return item ? getLabel(item) : ""
  }, [value, itemMap, getLabel])

  const [inputValue, setInputValue] = React.useState(selectedLabel)

  React.useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={itemIds}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringValue={(id) => {
        const item = itemMap.get(id as string)
        return item ? getLabel(item) : ""
      }}
      onInputValueChange={(next) => {
        setInputValue(next)
        setSearch(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const id = (next as string | null) ?? null
        onChange(id)
        if (id) {
          const item = itemMap.get(id)
          setInputValue(item ? getLabel(item) : "")
        } else {
          setInputValue("")
        }
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} />
      <ComboboxContent>
        <ComboboxEmpty>
          {isPending || selectedQuery.isPending ? "Loading…" : emptyText}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const item = itemMap.get(id as string)
              if (!item) return null
              const secondary = getSecondary?.(item)
              return (
                <ComboboxItem key={item.id} value={item.id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{getLabel(item)}</span>
                    {secondary && (
                      <span className="truncate text-xs text-muted-foreground">{secondary}</span>
                    )}
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
