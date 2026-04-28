import {
  type StageRecord,
  useOpportunityMutation,
  useOrganizations,
  usePeople,
} from "@voyantjs/crm-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
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
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const CURRENCY_CODES = Object.keys(currencies).sort()

export function CreateOpportunityDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: StageRecord[]
  onCreated: (id: string) => void
}) {
  const { create } = useOpportunityMutation()
  const [title, setTitle] = useState("")
  const [stageId, setStageId] = useState("")
  const [valueAmount, setValueAmount] = useState("")
  const [valueCurrency, setValueCurrency] = useState("USD")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [personId, setPersonId] = useState<string | null>(null)
  const [personLabel, setPersonLabel] = useState("")
  const [personSearch, setPersonSearch] = useState("")
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationLabel, setOrganizationLabel] = useState("")
  const [organizationSearch, setOrganizationSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  const peopleQuery = usePeople({ search: personSearch || undefined, limit: 20, enabled: open })
  const organizationsQuery = useOrganizations({
    search: organizationSearch || undefined,
    limit: 20,
    enabled: open,
  })

  const peopleResults = peopleQuery.data?.data ?? []
  const organizationsResults = organizationsQuery.data?.data ?? []
  const peopleIds = useMemo(() => peopleResults.map((person) => person.id), [peopleResults])
  const organizationIds = useMemo(
    () => organizationsResults.map((organization) => organization.id),
    [organizationsResults],
  )

  useEffect(() => {
    if (open) {
      setTitle("")
      setStageId(stages[0]?.id ?? "")
      setValueAmount("")
      setValueCurrency("USD")
      setExpectedCloseDate("")
      setPersonId(null)
      setPersonLabel("")
      setPersonSearch("")
      setOrganizationId(null)
      setOrganizationLabel("")
      setOrganizationSearch("")
      setError(null)
    }
  }, [open, stages])

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Title is required")
      return
    }
    if (!stageId) {
      setError("Stage is required")
      return
    }
    const amountCents = valueAmount.trim() ? Math.round(Number.parseFloat(valueAmount) * 100) : null
    if (amountCents != null && !Number.isFinite(amountCents)) {
      setError("Value must be a number")
      return
    }
    setError(null)
    try {
      const created = await create.mutateAsync({
        title: trimmed,
        pipelineId,
        stageId,
        personId,
        organizationId,
        valueAmountCents: amountCents,
        valueCurrency: valueCurrency.trim() || null,
        expectedCloseDate: expectedCloseDate.trim() || null,
      })
      onCreated(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create opportunity")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New opportunity</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-title">Title</Label>
            <Input
              id="opp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Honeymoon package for the Smiths"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-stage">Stage</Label>
            <Select
              value={stageId}
              onValueChange={(value) => setStageId(value ?? "")}
              items={stages.map((stage) => ({ label: stage.name, value: stage.id }))}
            >
              <SelectTrigger id="opp-stage" className="w-full">
                <SelectValue>
                  {(value) => stages.find((stage) => stage.id === value)?.name ?? "Select stage…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opp-person">Contact</Label>
              <Combobox
                items={peopleIds}
                value={personId}
                inputValue={personLabel}
                autoHighlight
                filter={() => true}
                itemToStringValue={(id) => {
                  const person = peopleResults.find((entry) => entry.id === (id as string))
                  return person ? `${person.firstName} ${person.lastName}`.trim() : ""
                }}
                onInputValueChange={(next) => {
                  const match = peopleResults.find((person) => person.id === next)
                  if (match) {
                    setPersonLabel(`${match.firstName} ${match.lastName}`.trim())
                    return
                  }
                  setPersonLabel(next)
                  setPersonSearch(next)
                  if (!next) setPersonId(null)
                }}
                onValueChange={(next) => {
                  const id = (next as string | null) ?? null
                  setPersonId(id)
                  const person = id ? peopleResults.find((entry) => entry.id === id) : null
                  setPersonLabel(person ? `${person.firstName} ${person.lastName}`.trim() : "")
                  setPersonSearch("")
                }}
              >
                <ComboboxInput
                  id="opp-person"
                  placeholder="Search people…"
                  className="h-9 text-sm"
                  showClear={Boolean(personId)}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {peopleQuery.isPending ? "Searching…" : "No people found"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(id: string) => {
                        const person = peopleResults.find((entry) => entry.id === id)
                        if (!person) return null
                        return (
                          <ComboboxItem key={id} value={id}>
                            <span className="truncate">
                              {`${person.firstName} ${person.lastName}`.trim() || "Unnamed"}
                            </span>
                            {person.email ? (
                              <span className="ml-2 truncate text-xs text-muted-foreground">
                                {person.email}
                              </span>
                            ) : null}
                          </ComboboxItem>
                        )
                      }}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opp-org">Organization</Label>
              <Combobox
                items={organizationIds}
                value={organizationId}
                inputValue={organizationLabel}
                autoHighlight
                filter={() => true}
                itemToStringValue={(id) => {
                  const organization = organizationsResults.find(
                    (entry) => entry.id === (id as string),
                  )
                  return organization?.name ?? ""
                }}
                onInputValueChange={(next) => {
                  const match = organizationsResults.find(
                    (organization) => organization.id === next,
                  )
                  if (match) {
                    setOrganizationLabel(match.name)
                    return
                  }
                  setOrganizationLabel(next)
                  setOrganizationSearch(next)
                  if (!next) setOrganizationId(null)
                }}
                onValueChange={(next) => {
                  const id = (next as string | null) ?? null
                  setOrganizationId(id)
                  const organization = id
                    ? organizationsResults.find((entry) => entry.id === id)
                    : null
                  setOrganizationLabel(organization?.name ?? "")
                  setOrganizationSearch("")
                }}
              >
                <ComboboxInput
                  id="opp-org"
                  placeholder="Search organizations…"
                  className="h-9 text-sm"
                  showClear={Boolean(organizationId)}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {organizationsQuery.isPending ? "Searching…" : "No organizations found"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(id: string) => {
                        const organization = organizationsResults.find((entry) => entry.id === id)
                        if (!organization) return null
                        return (
                          <ComboboxItem key={id} value={id}>
                            <span className="truncate">{organization.name}</span>
                            {organization.industry ? (
                              <span className="ml-2 truncate text-xs text-muted-foreground">
                                {organization.industry}
                              </span>
                            ) : null}
                          </ComboboxItem>
                        )
                      }}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="opp-value">Value</Label>
              <Input
                id="opp-value"
                type="number"
                min={0}
                step="0.01"
                value={valueAmount}
                onChange={(e) => setValueAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opp-currency">Currency</Label>
              <Combobox
                items={CURRENCY_CODES}
                value={valueCurrency}
                autoHighlight
                filter={(code, query) => {
                  const currency = currencies[code as keyof typeof currencies]
                  if (!currency) return false
                  const normalized = query.toLowerCase()
                  return (
                    currency.code.toLowerCase().includes(normalized) ||
                    currency.name.toLowerCase().includes(normalized)
                  )
                }}
                onValueChange={(next) => setValueCurrency(String(next ?? "USD"))}
              >
                <ComboboxInput id="opp-currency" placeholder="Currency…" className="h-9 text-sm" />
                <ComboboxContent>
                  <ComboboxEmpty>No currencies found</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(code: string) => {
                        const currency = currencies[code as keyof typeof currencies]
                        if (!currency) return null
                        return (
                          <ComboboxItem key={code} value={code}>
                            <span className="truncate">{currency.code}</span>
                            <span className="ml-2 truncate text-xs text-muted-foreground">
                              {currency.name}
                            </span>
                          </ComboboxItem>
                        )
                      }}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-close-date">Expected close date</Label>
            <DatePicker
              value={expectedCloseDate}
              onChange={(value) => setExpectedCloseDate(value ?? "")}
              className="w-full justify-start text-left font-normal"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
