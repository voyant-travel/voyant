"use client"

import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { Input } from "@voyantjs/ui/components/input"
import { CheckCircle2, Clock, Search, X, XCircle } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useWorkflowRunsUiMessagesOrDefault } from "../i18n/index.js"
import type { ListWorkflowRunsQuery, WorkflowRun, WorkflowRunStatus } from "../types.js"
import { TagChip } from "./common.js"

export const STATUS_OPTIONS: WorkflowRunStatus[] = ["running", "failed", "succeeded", "cancelled"]
export const TIME_RANGES = ["15m", "1h", "24h", "7d", "all"] as const

export type TimeRange = (typeof TIME_RANGES)[number]

export type WorkflowOption = {
  name: string
  count: number
}

export function WorkflowRunsFilters({
  filters,
  workflowOptions,
  tagOptions,
  statusFilters,
  tagFilters,
  searchQuery,
  timeRange,
  onChange,
  onToggleStatus,
  onAddTagFilter,
  onRemoveTagFilter,
  onSearchChange,
  onTimeRangeChange,
  onClear,
}: {
  filters: ListWorkflowRunsQuery
  workflowOptions: WorkflowOption[]
  tagOptions: string[]
  statusFilters: WorkflowRunStatus[]
  tagFilters: string[]
  searchQuery: string
  timeRange: TimeRange
  onChange: (next: ListWorkflowRunsQuery) => void
  onToggleStatus: (status: WorkflowRunStatus) => void
  onAddTagFilter: (tag: string) => void
  onRemoveTagFilter: (tag: string) => void
  onSearchChange: (value: string) => void
  onTimeRangeChange: (value: TimeRange) => void
  onClear: () => void
}) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    globalThis.addEventListener("keydown", onKeyDown)
    return () => globalThis.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{messages.page.filterTitle}</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {messages.page.clearFilters}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={messages.page.searchLabel}>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="pl-8"
              placeholder={messages.page.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </Field>
        <Field label={messages.page.workflowLabel}>
          <WorkflowCombobox
            value={filters.workflowName ?? null}
            options={workflowOptions}
            placeholder={messages.page.workflowPlaceholder}
            emptyLabel={messages.page.workflowEmpty}
            onChange={(workflowName) =>
              onChange({ ...filters, workflowName: workflowName ?? undefined })
            }
          />
        </Field>
        <Field label={messages.page.statusLabel}>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={statusFilters.length === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => {
                for (const status of statusFilters) onToggleStatus(status)
              }}
            >
              {messages.page.anyStatus}
            </Button>
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                type="button"
                variant={statusFilters.includes(status) ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleStatus(status)}
                aria-pressed={statusFilters.includes(status)}
              >
                <StatusGlyph status={status} />
                {messages.status[status]}
              </Button>
            ))}
          </div>
        </Field>
        <Field label={messages.page.timeRangeLabel}>
          <div className="flex flex-wrap gap-1.5">
            {TIME_RANGES.map((range) => (
              <Button
                key={range}
                type="button"
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => onTimeRangeChange(range)}
                aria-pressed={timeRange === range}
              >
                {messages.page.timeRanges[range]}
              </Button>
            ))}
          </div>
        </Field>
        <Field label={messages.page.tagLabel}>
          <TagFilterBuilder
            tagOptions={tagOptions}
            tagFilters={tagFilters}
            placeholder={messages.page.tagPlaceholder}
            emptyLabel={messages.page.tagEmpty}
            addLabel={messages.page.addTag}
            removeLabel={messages.page.removeTag}
            onAdd={onAddTagFilter}
            onRemove={onRemoveTagFilter}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

export function buildFilterOptions(runs: WorkflowRun[], selectedWorkflow?: string) {
  const workflowCounts = new Map<string, number>()
  const tags = new Set<string>()

  for (const run of runs) {
    workflowCounts.set(run.workflowName, (workflowCounts.get(run.workflowName) ?? 0) + 1)
    for (const tag of run.tags) tags.add(tag)
  }
  if (selectedWorkflow && !workflowCounts.has(selectedWorkflow)) {
    workflowCounts.set(selectedWorkflow, 0)
  }

  return {
    workflows: Array.from(workflowCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
  }
}

function WorkflowCombobox({
  value,
  options,
  placeholder,
  emptyLabel,
  onChange,
}: {
  value: string | null
  options: WorkflowOption[]
  placeholder: string
  emptyLabel: string
  onChange: (value: string | null) => void
}) {
  const itemMap = useMemo(() => new Map(options.map((item) => [item.name, item])), [options])
  const selectedLabel = value ?? ""
  const [inputValue, setInputValue] = useState(selectedLabel)

  useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={options.map((item) => item.name)}
      value={value}
      inputValue={inputValue}
      autoHighlight
      itemToStringValue={(item) => String(item)}
      onInputValueChange={(next) => {
        setInputValue(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const nextValue = (next as string | null) ?? null
        onChange(nextValue)
        setInputValue(nextValue ?? "")
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={!!value} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(name) => {
              const option = itemMap.get(String(name))
              if (!option) return null
              return (
                <ComboboxItem key={option.name} value={option.name}>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="truncate font-medium">{option.name}</span>
                    <span className="text-muted-foreground text-xs">{option.count}</span>
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

function TagFilterBuilder({
  tagOptions,
  tagFilters,
  placeholder,
  emptyLabel,
  addLabel,
  removeLabel,
  onAdd,
  onRemove,
}: {
  tagOptions: string[]
  tagFilters: string[]
  placeholder: string
  emptyLabel: string
  addLabel: string
  removeLabel: string
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}) {
  const [inputValue, setInputValue] = useState("")

  const submit = () => {
    const next = inputValue.trim()
    if (!next) return
    onAdd(next)
    setInputValue("")
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Combobox
          items={tagOptions}
          value={null}
          inputValue={inputValue}
          autoHighlight
          itemToStringValue={(item) => String(item)}
          onInputValueChange={setInputValue}
          onValueChange={(next) => {
            const tag = (next as string | null) ?? ""
            if (tag) {
              onAdd(tag)
              setInputValue("")
            }
          }}
        >
          <ComboboxInput placeholder={placeholder} className="w-full" />
          <ComboboxContent>
            <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(tag) => (
                  <ComboboxItem key={String(tag)} value={String(tag)}>
                    <TagChip tag={String(tag)} />
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button type="button" variant="outline" size="sm" onClick={submit}>
          {addLabel}
        </Button>
      </div>
      {tagFilters.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tagFilters.map((tag) => (
            <button
              key={tag}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
              onClick={() => onRemove(tag)}
              aria-label={`${removeLabel}: ${tag}`}
            >
              <TagChip tag={tag} />
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  )
}

function StatusGlyph({ status }: { status: WorkflowRunStatus }) {
  if (status === "succeeded") return <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
  if (status === "failed") return <XCircle data-icon="inline-start" aria-hidden="true" />
  return <Clock data-icon="inline-start" aria-hidden="true" />
}
