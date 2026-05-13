"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useVoyantFinanceContext } from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { type FinanceUiMessages, useFinanceUiMessagesOrDefault } from "../i18n/index.js"

const TAX_CODE_OPTIONS = [
  "standard",
  "reduced",
  "exempt",
  "reverse_charge",
  "margin_scheme_art311",
  "zero_rated",
  "out_of_scope",
  "other",
] as const

type TaxRegimeCode = (typeof TAX_CODE_OPTIONS)[number]
type TaxClassAppliesTo = "base" | "addon" | "accommodation" | "all"
type TaxPolicySide = "sell" | "buy"
type TaxPolicyConditionMode = "always" | "all" | "any"
type TaxPolicyConditionFact = "hasAccommodation" | "accommodationCountries"
type TaxPolicyConditionOperator = "eq" | "contains"

export interface TaxesPageApi {
  get: <T = unknown>(path: string) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>
  patch: <T = unknown>(path: string, body?: unknown) => Promise<T>
  delete: <T = unknown>(path: string) => Promise<T>
}

export interface TaxesPageProps {
  api?: TaxesPageApi
}

const TaxesPageApiContext = createContext<TaxesPageApi | null>(null)

function joinUrl(baseUrl: string, path: string) {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = await response.text().catch(() => undefined)
    }
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `API error: ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function createTaxesPageApi(
  baseUrl: string,
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const request = async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
    return readJson<T>(await fetcher(joinUrl(baseUrl, path), { ...init, headers }))
  }

  const api: TaxesPageApi = {
    get: <T = unknown>(path: string) => request<T>(path, { method: "GET" }),
    post: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    patch: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "PATCH", // i18n-literal-ok HTTP method
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }), // i18n-literal-ok HTTP method
  }

  return api
}

function useTaxesPageApi() {
  const api = useContext(TaxesPageApiContext)
  if (!api) throw new Error("TaxesPage requires a TaxesPageApiContext provider")
  return api
}

const TAX_CLASS_APPLIES_TO_OPTIONS: TaxClassAppliesTo[] = ["base", "addon", "accommodation", "all"]
const TAX_POLICY_CONDITION_FACT_OPTIONS: TaxPolicyConditionFact[] = [
  "hasAccommodation",
  "accommodationCountries",
]

type TaxRegimeRecord = {
  id: string
  code: TaxRegimeCode
  name: string
  jurisdiction: string | null
  ratePercent: number | null
  description: string | null
  legalReference: string | null
  active: boolean
}

type TaxClassRecord = {
  id: string
  code: string
  label: string
  description: string | null
  defaultRegimeId: string | null
  lines: TaxClassLineRecord[] | null
  active: boolean
}

type TaxClassLineRecord = {
  regime_id: string
  applies_to: TaxClassAppliesTo
}

type TaxRow = {
  taxClass: TaxClassRecord
  regime: TaxRegimeRecord | null
}

type TaxPolicyProfileRecord = {
  id: string
  code: string
  name: string
  jurisdiction: string | null
  description: string | null
  active: boolean
}

type TaxPolicyRuleRecord = {
  id: string
  profileId: string
  side: TaxPolicySide
  priority: number
  name: string
  appliesTo: TaxClassAppliesTo
  condition: Record<string, unknown> | null
  taxRegimeId: string
  active: boolean
}

type TaxFormState = {
  taxClassLabel: string
  taxClassCode: string
  taxClassDescription: string
  regimeName: string
  regimeCode: TaxRegimeCode
  jurisdiction: string
  ratePercent: string
  regimeDescription: string
  legalReference: string
  lines: Array<{
    key: string
    appliesTo: TaxClassAppliesTo
    regimeId: string
  }>
  active: boolean
}

type PolicyProfileFormState = {
  name: string
  code: string
  jurisdiction: string
  description: string
  active: boolean
}

type PolicyRuleFormState = {
  profileId: string
  side: TaxPolicySide
  priority: string
  name: string
  appliesTo: TaxClassAppliesTo
  conditionMode: TaxPolicyConditionMode
  conditions: Array<{
    key: string
    fact: TaxPolicyConditionFact
    operator: TaxPolicyConditionOperator
    value: string
  }>
  taxRegimeId: string
  active: boolean
}

const EMPTY_FORM: TaxFormState = {
  taxClassLabel: "",
  taxClassCode: "",
  taxClassDescription: "",
  regimeName: "",
  regimeCode: "standard",
  jurisdiction: "RO",
  ratePercent: "0",
  regimeDescription: "",
  legalReference: "",
  lines: [],
  active: true,
}

const EMPTY_POLICY_PROFILE_FORM: PolicyProfileFormState = {
  name: "",
  code: "",
  jurisdiction: "RO",
  description: "",
  active: true,
}

const EMPTY_POLICY_RULE_FORM: PolicyRuleFormState = {
  profileId: "",
  side: "sell",
  priority: "100",
  name: "",
  appliesTo: "all",
  conditionMode: "always",
  conditions: [],
  taxRegimeId: "",
  active: true,
}

let taxClassLineKey = 0
let taxPolicyConditionKey = 0

function nextTaxClassLineKey(seed = "line") {
  taxClassLineKey += 1
  return `${seed}-${taxClassLineKey}`
}

function nextTaxPolicyConditionKey(seed = "condition") {
  taxPolicyConditionKey += 1
  return `${seed}-${taxPolicyConditionKey}`
}

function initialForm(row: TaxRow | undefined): TaxFormState {
  if (!row) return EMPTY_FORM
  return {
    taxClassLabel: row.taxClass.label,
    taxClassCode: row.taxClass.code,
    taxClassDescription: row.taxClass.description ?? "",
    regimeName: row.regime?.name ?? row.taxClass.label,
    regimeCode: row.regime?.code ?? "other",
    jurisdiction: row.regime?.jurisdiction ?? "RO",
    ratePercent: row.regime?.ratePercent != null ? String(row.regime.ratePercent) : "0",
    regimeDescription: row.regime?.description ?? "",
    legalReference: row.regime?.legalReference ?? "",
    lines: (row.taxClass.lines ?? []).map((line) => ({
      key: nextTaxClassLineKey(`${line.applies_to}-${line.regime_id}`),
      appliesTo: line.applies_to,
      regimeId: line.regime_id,
    })),
    active: row.taxClass.active,
  }
}

function initialPolicyProfileForm(
  profile: TaxPolicyProfileRecord | undefined,
): PolicyProfileFormState {
  if (!profile) return EMPTY_POLICY_PROFILE_FORM
  return {
    name: profile.name,
    code: profile.code,
    jurisdiction: profile.jurisdiction ?? "",
    description: profile.description ?? "",
    active: profile.active,
  }
}

function initialPolicyRuleForm(
  rule: TaxPolicyRuleRecord | undefined,
  profileId: string,
  taxRegimeId: string,
): PolicyRuleFormState {
  if (!rule) {
    return {
      ...EMPTY_POLICY_RULE_FORM,
      profileId,
      taxRegimeId,
    }
  }
  return {
    profileId: rule.profileId,
    side: rule.side,
    priority: String(rule.priority),
    name: rule.name,
    appliesTo: rule.appliesTo,
    ...parsePolicyCondition(rule.condition),
    taxRegimeId: rule.taxRegimeId,
    active: rule.active,
  }
}

function parsePolicyCondition(
  condition: Record<string, unknown> | null,
): Pick<PolicyRuleFormState, "conditionMode" | "conditions"> {
  if (!condition || condition.always === true) {
    return { conditionMode: "always", conditions: [] }
  }

  const group = Array.isArray(condition.all)
    ? { mode: "all" as const, expressions: condition.all }
    : Array.isArray(condition.any)
      ? { mode: "any" as const, expressions: condition.any }
      : { mode: "all" as const, expressions: [condition] }

  const conditions = group.expressions
    .map(parsePolicyConditionExpression)
    .filter((row): row is PolicyRuleFormState["conditions"][number] => Boolean(row))

  return {
    conditionMode: conditions.length ? group.mode : "always",
    conditions,
  }
}

function parsePolicyConditionExpression(
  expression: unknown,
): PolicyRuleFormState["conditions"][number] | null {
  if (typeof expression !== "object" || expression === null || Array.isArray(expression)) {
    return null
  }
  const record = expression as Record<string, unknown>
  if (record.fact === "hasAccommodation") {
    return {
      key: nextTaxPolicyConditionKey("has-accommodation"),
      fact: "hasAccommodation",
      operator: "eq",
      value: record.eq === false ? "false" : "true",
    }
  }
  if (record.fact === "accommodationCountries") {
    return {
      key: nextTaxPolicyConditionKey("accommodation-countries"),
      fact: "accommodationCountries",
      operator: "contains",
      value: typeof record.contains === "string" ? record.contains : "RO", // i18n-literal-ok ISO country default
    }
  }
  return null
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function formatRate(value: number | null) {
  return value == null ? "-" : `${value}%`
}

function appliesToLabel(messages: FinanceUiMessages, appliesTo: TaxClassAppliesTo) {
  const taxMessages = messages.taxesPage
  switch (appliesTo) {
    case "base":
      return taxMessages.appliesToBase
    case "addon":
      return taxMessages.appliesToAddon
    case "accommodation":
      return taxMessages.appliesToAccommodation
    case "all":
      return taxMessages.appliesToAll
  }
}

function summarizeCondition(
  messages: FinanceUiMessages,
  condition: Record<string, unknown> | null,
) {
  const taxMessages = messages.taxesPage
  if (!condition) return "-"
  if (condition.always === true) return taxMessages.policyConditionAlways
  const parsed = parsePolicyCondition(condition)
  if (parsed.conditionMode === "always") return taxMessages.policyConditionAlways
  const prefix =
    parsed.conditionMode === "all"
      ? taxMessages.policyConditionModeAll
      : taxMessages.policyConditionModeAny
  const labels = parsed.conditions.map((row) => summarizeConditionRow(messages, row))
  return `${prefix}: ${labels.join("; ")}`
}

function summarizeConditionRow(
  messages: FinanceUiMessages,
  condition: PolicyRuleFormState["conditions"][number],
) {
  const taxMessages = messages.taxesPage
  if (condition.fact === "hasAccommodation") {
    return `${taxMessages.policyFactHasAccommodation} ${
      condition.value === "false" ? taxMessages.policyValueNo : taxMessages.policyValueYes
    }`
  }
  if (condition.fact === "accommodationCountries") {
    return `${taxMessages.policyFactAccommodationCountries} ${taxMessages.policyOperatorContains} ${condition.value}`
  }
  return "custom"
}

function normalizeCondition(
  condition: PolicyRuleFormState["conditions"][number],
): PolicyRuleFormState["conditions"][number] {
  if (condition.fact === "hasAccommodation") {
    return {
      ...condition,
      operator: "eq",
      value: condition.value === "false" ? "false" : "true",
    }
  }
  return {
    ...condition,
    operator: "contains",
    value: condition.value.trim().toUpperCase() || "RO",
  }
}

function buildPolicyCondition(
  form: PolicyRuleFormState,
  taxMessages: FinanceUiMessages["taxesPage"],
): Record<string, unknown> {
  if (form.conditionMode === "always") {
    return { always: true }
  }

  const expressions = form.conditions.map((row) => {
    const condition = normalizeCondition(row)
    if (condition.fact === "hasAccommodation") {
      return { fact: "hasAccommodation", eq: condition.value === "true" }
    }

    if (!/^[A-Z]{2}$/.test(condition.value)) {
      throw new Error(taxMessages.validationPolicyRuleConditionInvalid)
    }
    return { fact: "accommodationCountries", contains: condition.value }
  })

  if (!expressions.length) {
    throw new Error(taxMessages.validationPolicyRuleConditionInvalid)
  }

  return form.conditionMode === "all" ? { all: expressions } : { any: expressions }
}

export function TaxesPage({ api: apiProp }: TaxesPageProps = {}) {
  if (apiProp) return <TaxesPageContent api={apiProp} />
  return <TaxesPageWithDefaultApi />
}

function TaxesPageWithDefaultApi() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const api = useMemo(() => createTaxesPageApi(baseUrl, fetcher), [baseUrl, fetcher])
  return <TaxesPageContent api={api} />
}

function TaxesPageContent({ api }: { api: TaxesPageApi }) {
  const messages = useFinanceUiMessagesOrDefault()
  const taxMessages = messages.taxesPage
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<TaxRow | undefined>()
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<TaxPolicyProfileRecord | undefined>()
  const [ruleSheetOpen, setRuleSheetOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<TaxPolicyRuleRecord | undefined>()
  const [ruleProfileId, setRuleProfileId] = useState<string>("")

  const taxClassesQuery = useQuery({
    queryKey: ["tax-classes"],
    queryFn: () =>
      api.get<{ data: TaxClassRecord[]; total: number }>("/v1/finance/tax-classes?limit=100"),
  })
  const taxRegimesQuery = useQuery({
    queryKey: ["tax-regimes"],
    queryFn: () =>
      api.get<{ data: TaxRegimeRecord[]; total: number }>("/v1/finance/tax-regimes?limit=100"),
  })
  const policyProfilesQuery = useQuery({
    queryKey: ["tax-policy-profiles"],
    queryFn: () =>
      api.get<{ data: TaxPolicyProfileRecord[]; total: number }>(
        "/v1/finance/tax-policy-profiles?limit=100",
      ),
  })
  const policyRulesQuery = useQuery({
    queryKey: ["tax-policy-rules"],
    queryFn: () =>
      api.get<{ data: TaxPolicyRuleRecord[]; total: number }>(
        "/v1/finance/tax-policy-rules?limit=100",
      ),
  })

  const regimesById = useMemo(
    () => new Map((taxRegimesQuery.data?.data ?? []).map((regime) => [regime.id, regime])),
    [taxRegimesQuery.data],
  )
  const rows = useMemo(
    () =>
      (taxClassesQuery.data?.data ?? []).map((taxClass) => ({
        taxClass,
        regime: taxClass.defaultRegimeId
          ? (regimesById.get(taxClass.defaultRegimeId) ?? null)
          : null,
      })),
    [regimesById, taxClassesQuery.data],
  )
  const policyRulesByProfileId = useMemo(() => {
    const grouped = new Map<string, TaxPolicyRuleRecord[]>()
    for (const rule of policyRulesQuery.data?.data ?? []) {
      const existing = grouped.get(rule.profileId) ?? []
      existing.push(rule)
      grouped.set(rule.profileId, existing)
    }
    for (const rules of grouped.values()) {
      rules.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    }
    return grouped
  }, [policyRulesQuery.data])
  const isPending =
    taxClassesQuery.isPending ||
    taxRegimesQuery.isPending ||
    policyProfilesQuery.isPending ||
    policyRulesQuery.isPending

  const deleteMutation = useMutation({
    mutationFn: async (row: TaxRow) => {
      await api.delete(`/v1/finance/tax-classes/${row.taxClass.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-classes"] })
    },
  })
  const deleteProfileMutation = useMutation({
    mutationFn: async (profile: TaxPolicyProfileRecord) => {
      const rules = policyRulesByProfileId.get(profile.id) ?? []
      await Promise.all(rules.map((rule) => api.delete(`/v1/finance/tax-policy-rules/${rule.id}`)))
      await api.delete(`/v1/finance/tax-policy-profiles/${profile.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-profiles"] })
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-rules"] })
    },
  })
  const deleteRuleMutation = useMutation({
    mutationFn: async (rule: TaxPolicyRuleRecord) => {
      await api.delete(`/v1/finance/tax-policy-rules/${rule.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-rules"] })
    },
  })

  return (
    <TaxesPageApiContext.Provider value={api}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{taxMessages.title}</h2>
            <p className="text-sm text-muted-foreground">{taxMessages.description}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined)
              setSheetOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {taxMessages.addTax}
          </Button>
        </div>

        {isPending ? (
          <TaxesPageSkeleton rows={5} />
        ) : (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            {rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{taxMessages.empty}</p>
            ) : (
              <div className="flex flex-col divide-y">
                {rows.map((row) => {
                  const overrideLines = row.taxClass.lines ?? []
                  return (
                    <div
                      key={row.taxClass.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{row.taxClass.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.taxClass.code}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {taxMessages.taxClassBadge}
                          </Badge>
                          {overrideLines.length ? (
                            <Badge variant="outline" className="text-xs">
                              {taxMessages.regimeOverrideCount.replace(
                                "{count}",
                                String(overrideLines.length),
                              )}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{taxMessages.defaultRegimeLabel}</span>
                          <span>{row.regime?.name ?? "-"}</span>
                          <span className="font-mono">{row.regime?.code ?? "-"}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatRate(row.regime?.ratePercent ?? null)}
                          </Badge>
                          {!row.taxClass.active ? (
                            <Badge variant="secondary" className="text-xs">
                              {taxMessages.inactive}
                            </Badge>
                          ) : null}
                        </div>
                        {overrideLines.length ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{taxMessages.regimeOverridesLabel}</span>
                            {overrideLines.map((line) => {
                              const regime = regimesById.get(line.regime_id)
                              return (
                                <Badge
                                  key={`${line.applies_to}-${line.regime_id}`}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {appliesToLabel(messages, line.applies_to)}:{" "}
                                  {regime?.name ?? line.regime_id}
                                </Badge>
                              )
                            })}
                          </div>
                        ) : null}
                        {row.taxClass.description || row.regime?.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.taxClass.description ?? row.regime?.description}
                          </p>
                        ) : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(row)
                              setSheetOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            {taxMessages.edit}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              if (confirm(taxMessages.deleteConfirm)) {
                                deleteMutation.mutate(row)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {taxMessages.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <TaxSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          row={editing}
          onSuccess={() => {
            setSheetOpen(false)
            setEditing(undefined)
            void queryClient.invalidateQueries({ queryKey: ["tax-classes"] })
            void queryClient.invalidateQueries({ queryKey: ["tax-regimes"] })
          }}
          taxRegimes={taxRegimesQuery.data?.data ?? []}
        />

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{taxMessages.policyTitle}</h2>
            <p className="text-sm text-muted-foreground">{taxMessages.policyDescription}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingProfile(undefined)
              setProfileSheetOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {taxMessages.addPolicyProfile}
          </Button>
        </div>

        {isPending ? null : (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            {(policyProfilesQuery.data?.data ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {taxMessages.policyEmpty}
              </p>
            ) : (
              <div className="flex flex-col divide-y">
                {(policyProfilesQuery.data?.data ?? []).map((profile) => {
                  const profileRules = policyRulesByProfileId.get(profile.id) ?? []
                  return (
                    <div key={profile.id} className="flex flex-col gap-3 px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{profile.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {profile.code}
                            </span>
                            {profile.jurisdiction ? (
                              <Badge variant="outline" className="text-xs">
                                {profile.jurisdiction}
                              </Badge>
                            ) : null}
                            {!profile.active ? (
                              <Badge variant="secondary" className="text-xs">
                                {taxMessages.inactive}
                              </Badge>
                            ) : null}
                          </div>
                          {profile.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {profile.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingRule(undefined)
                              setRuleProfileId(profile.id)
                              setRuleSheetOpen(true)
                            }}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            {taxMessages.addPolicyRule}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingProfile(profile)
                                  setProfileSheetOpen(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                {taxMessages.edit}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(taxMessages.deletePolicyProfileConfirm)) {
                                    deleteProfileMutation.mutate(profile)
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {taxMessages.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {profileRules.length ? (
                        <div className="overflow-hidden rounded-md border">
                          <div className="grid grid-cols-[5rem_5rem_minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                            <span>{taxMessages.policyPriorityLabel}</span>
                            <span>{taxMessages.policySideLabel}</span>
                            <span>{taxMessages.policyRuleNameLabel}</span>
                            <span>{taxMessages.appliesToLabel}</span>
                            <span>{taxMessages.policyConditionLabel}</span>
                            <span>{taxMessages.taxRegimeLabel}</span>
                            <span>{taxMessages.policyActionsLabel}</span>
                          </div>
                          {profileRules.map((rule) => {
                            const regime = regimesById.get(rule.taxRegimeId)
                            return (
                              <div
                                key={rule.id}
                                className="grid grid-cols-[5rem_5rem_minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                              >
                                <span className="font-mono text-xs">{rule.priority}</span>
                                <span className="text-xs">
                                  {rule.side === "sell"
                                    ? taxMessages.policySideSell
                                    : taxMessages.policySideBuy}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{rule.name}</div>
                                  {!rule.active ? (
                                    <Badge variant="secondary" className="mt-1 text-xs">
                                      {taxMessages.inactive}
                                    </Badge>
                                  ) : null}
                                </div>
                                <span className="text-xs">
                                  {appliesToLabel(messages, rule.appliesTo)}
                                </span>
                                <code className="truncate text-xs text-muted-foreground">
                                  {summarizeCondition(messages, rule.condition)}
                                </code>
                                <span className="truncate text-xs">
                                  {regime
                                    ? `${regime.name} (${formatRate(regime.ratePercent)})`
                                    : rule.taxRegimeId}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingRule(rule)
                                        setRuleProfileId(rule.profileId)
                                        setRuleSheetOpen(true)
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      {taxMessages.edit}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        if (confirm(taxMessages.deletePolicyRuleConfirm)) {
                                          deleteRuleMutation.mutate(rule)
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {taxMessages.delete}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          {taxMessages.policyRulesEmpty}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <PolicyProfileSheet
          open={profileSheetOpen}
          onOpenChange={setProfileSheetOpen}
          profile={editingProfile}
          onSuccess={() => {
            setProfileSheetOpen(false)
            setEditingProfile(undefined)
            void queryClient.invalidateQueries({ queryKey: ["tax-policy-profiles"] })
          }}
        />

        <PolicyRuleSheet
          open={ruleSheetOpen}
          onOpenChange={setRuleSheetOpen}
          rule={editingRule}
          profileId={ruleProfileId}
          taxRegimes={taxRegimesQuery.data?.data ?? []}
          onSuccess={() => {
            setRuleSheetOpen(false)
            setEditingRule(undefined)
            setRuleProfileId("")
            void queryClient.invalidateQueries({ queryKey: ["tax-policy-rules"] })
          }}
        />
      </div>
    </TaxesPageApiContext.Provider>
  )
}

function TaxesPageSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
            key={index}
            className="flex items-center justify-between px-6 py-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TaxSheet({
  open,
  onOpenChange,
  row,
  onSuccess,
  taxRegimes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row?: TaxRow
  onSuccess: () => void
  taxRegimes: TaxRegimeRecord[]
}) {
  const messages = useFinanceUiMessagesOrDefault()
  const taxMessages = messages.taxesPage
  const api = useTaxesPageApi()
  const [form, setForm] = useState<TaxFormState>(() => initialForm(row))
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!row

  useEffect(() => {
    setForm(initialForm(row))
    setError(null)
  }, [row])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.taxClassLabel.trim()) throw new Error(taxMessages.validationNameRequired)
      const ratePercent = Number(form.ratePercent)
      if (!Number.isFinite(ratePercent) || ratePercent < 0) {
        throw new Error(taxMessages.validationRateInvalid)
      }
      const regimeInput = {
        code: form.regimeCode,
        name: form.regimeName.trim() || form.taxClassLabel.trim(),
        jurisdiction: form.jurisdiction.trim() || null,
        ratePercent: Math.round(ratePercent),
        description: form.regimeDescription.trim() || null,
        legalReference: form.legalReference.trim() || null,
        active: form.active,
      }
      const taxClassInput = {
        code: form.taxClassCode.trim() || toSlug(form.taxClassLabel),
        label: form.taxClassLabel.trim(),
        description: form.taxClassDescription.trim() || null,
        lines: form.lines.length
          ? form.lines
              .filter((line) => line.regimeId.trim())
              .map((line) => ({
                regime_id: line.regimeId,
                applies_to: line.appliesTo,
              }))
          : null,
        active: form.active,
      }

      const regimeEnvelope = row?.regime
        ? await api.patch<{ data: TaxRegimeRecord }>(
            `/v1/finance/tax-regimes/${row.regime.id}`,
            regimeInput,
          )
        : await api.post<{ data: TaxRegimeRecord }>("/v1/finance/tax-regimes", regimeInput)
      const regime = regimeEnvelope.data

      if (row) {
        await api.patch(`/v1/finance/tax-classes/${row.taxClass.id}`, {
          ...taxClassInput,
          defaultRegimeId: regime.id,
        })
      } else {
        await api.post("/v1/finance/tax-classes", {
          ...taxClassInput,
          defaultRegimeId: regime.id,
        })
      }
    },
    onSuccess,
    onError: (err) => setError(err instanceof Error ? err.message : taxMessages.saveFailed),
  })

  const setField =
    <K extends keyof TaxFormState>(key: K) =>
    (value: TaxFormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }))

  const updateLine = (
    index: number,
    patch: Partial<{ appliesTo: TaxClassAppliesTo; regimeId: string }>,
  ) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addLine = () => {
    const regimeId = taxRegimes[0]?.id
    if (!regimeId) return
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { key: nextTaxClassLineKey(), appliesTo: "all", regimeId }],
    }))
  }

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? taxMessages.editSheetTitle : taxMessages.newSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <h3 className="text-sm font-medium">{taxMessages.taxClassSectionTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  {taxMessages.taxClassSectionDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.taxClassLabelLabel}</Label>
                  <Input
                    value={form.taxClassLabel}
                    onChange={(event) => {
                      const next = event.target.value
                      setForm((current) => ({
                        ...current,
                        taxClassLabel: next,
                        taxClassCode: current.taxClassCode || toSlug(next),
                        regimeName: current.regimeName || next,
                      }))
                    }}
                    placeholder={taxMessages.taxClassLabelPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.taxClassCodeLabel}</Label>
                  <Input
                    value={form.taxClassCode}
                    onChange={(event) => setField("taxClassCode")(event.target.value)}
                    placeholder={taxMessages.taxClassCodePlaceholder}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{taxMessages.taxClassDescriptionLabel}</Label>
                <Textarea
                  value={form.taxClassDescription}
                  onChange={(event) => setField("taxClassDescription")(event.target.value)}
                  placeholder={taxMessages.taxClassDescriptionPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <h3 className="text-sm font-medium">{taxMessages.defaultRegimeSectionTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  {taxMessages.defaultRegimeSectionDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.regimeNameLabel}</Label>
                  <Input
                    value={form.regimeName}
                    onChange={(event) => setField("regimeName")(event.target.value)}
                    placeholder={taxMessages.regimeNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.regimeCodeLabel}</Label>
                  <Select
                    value={form.regimeCode}
                    onValueChange={(value) => setField("regimeCode")(value as TaxRegimeCode)}
                    items={TAX_CODE_OPTIONS.map((code) => ({ value: code, label: code }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_CODE_OPTIONS.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.rateLabel}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.ratePercent}
                    onChange={(event) => setField("ratePercent")(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{taxMessages.jurisdictionLabel}</Label>
                  <Input
                    value={form.jurisdiction}
                    onChange={(event) => setField("jurisdiction")(event.target.value)}
                    placeholder="RO"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{taxMessages.legalReferenceLabel}</Label>
                <Input
                  value={form.legalReference}
                  onChange={(event) => setField("legalReference")(event.target.value)}
                  placeholder={taxMessages.legalReferencePlaceholder}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>{taxMessages.regimeDescriptionLabel}</Label>
                <Textarea
                  value={form.regimeDescription}
                  onChange={(event) => setField("regimeDescription")(event.target.value)}
                  placeholder={taxMessages.regimeDescriptionPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium">{taxMessages.regimeOverridesSectionTitle}</h3>
                  <p className="text-xs text-muted-foreground">
                    {taxMessages.regimeOverridesSectionDescription}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  disabled={!taxRegimes.length}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {taxMessages.addRegimeOverride}
                </Button>
              </div>

              {form.lines.length ? (
                <div className="flex flex-col gap-2">
                  {form.lines.map((line, index) => (
                    <div
                      key={line.key}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-2"
                    >
                      <div className="flex flex-col gap-2">
                        <Label>{taxMessages.appliesToLabel}</Label>
                        <Select
                          value={line.appliesTo}
                          onValueChange={(value) =>
                            updateLine(index, { appliesTo: value as TaxClassAppliesTo })
                          }
                          items={TAX_CLASS_APPLIES_TO_OPTIONS.map((appliesTo) => ({
                            value: appliesTo,
                            label: appliesToLabel(messages, appliesTo),
                          }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_CLASS_APPLIES_TO_OPTIONS.map((appliesTo) => (
                              <SelectItem key={appliesTo} value={appliesTo}>
                                {appliesToLabel(messages, appliesTo)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>{taxMessages.taxRegimeLabel}</Label>
                        <Select
                          value={line.regimeId}
                          onValueChange={(value) => updateLine(index, { regimeId: value ?? "" })}
                          items={taxRegimes.map((regime) => ({
                            value: regime.id,
                            label: `${regime.name} (${formatRate(regime.ratePercent)})`,
                          }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {taxRegimes.map((regime) => (
                              <SelectItem key={regime.id} value={regime.id}>
                                {regime.name} ({formatRate(regime.ratePercent)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(index)}
                        aria-label={taxMessages.removeRegimeOverride}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{taxMessages.noRegimeOverrides}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={setField("active")} />
              <Label>{taxMessages.activeLabel}</Label>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {taxMessages.cancel}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? taxMessages.saveChanges : taxMessages.createTax}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function PolicyProfileSheet({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile?: TaxPolicyProfileRecord
  onSuccess: () => void
}) {
  const messages = useFinanceUiMessagesOrDefault()
  const taxMessages = messages.taxesPage
  const api = useTaxesPageApi()
  const [form, setForm] = useState<PolicyProfileFormState>(() => initialPolicyProfileForm(profile))
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!profile

  useEffect(() => {
    setForm(initialPolicyProfileForm(profile))
    setError(null)
  }, [profile])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(taxMessages.validationPolicyProfileNameRequired)
      const input = {
        name: form.name.trim(),
        code: form.code.trim() || toSlug(form.name),
        jurisdiction: form.jurisdiction.trim() || null,
        description: form.description.trim() || null,
        active: form.active,
      }

      if (profile) {
        await api.patch(`/v1/finance/tax-policy-profiles/${profile.id}`, input)
      } else {
        await api.post("/v1/finance/tax-policy-profiles", input)
      }
    },
    onSuccess,
    onError: (err) =>
      setError(err instanceof Error ? err.message : taxMessages.savePolicyProfileFailed),
  })

  const setField =
    <K extends keyof PolicyProfileFormState>(key: K) =>
    (value: PolicyProfileFormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? taxMessages.editPolicyProfileSheetTitle
              : taxMessages.newPolicyProfileSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policyProfileNameLabel}</Label>
                <Input
                  value={form.name}
                  onChange={(event) => {
                    const next = event.target.value
                    setForm((current) => ({
                      ...current,
                      name: next,
                      code: current.code || toSlug(next),
                    }))
                  }}
                  placeholder={taxMessages.policyProfileNamePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policyProfileCodeLabel}</Label>
                <Input
                  value={form.code}
                  onChange={(event) => setField("code")(event.target.value)}
                  placeholder={taxMessages.policyProfileCodePlaceholder}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{taxMessages.jurisdictionLabel}</Label>
              <Input
                value={form.jurisdiction}
                onChange={(event) => setField("jurisdiction")(event.target.value.toUpperCase())}
                placeholder="RO"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{taxMessages.policyProfileDescriptionLabel}</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setField("description")(event.target.value)}
                placeholder={taxMessages.policyProfileDescriptionPlaceholder}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={setField("active")} />
              <Label>{taxMessages.activeLabel}</Label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {taxMessages.cancel}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? taxMessages.saveChanges : taxMessages.createPolicyProfile}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function PolicyRuleSheet({
  open,
  onOpenChange,
  rule,
  profileId,
  taxRegimes,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: TaxPolicyRuleRecord
  profileId: string
  taxRegimes: TaxRegimeRecord[]
  onSuccess: () => void
}) {
  const messages = useFinanceUiMessagesOrDefault()
  const taxMessages = messages.taxesPage
  const api = useTaxesPageApi()
  const defaultTaxRegimeId = taxRegimes[0]?.id ?? ""
  const [form, setForm] = useState<PolicyRuleFormState>(() =>
    initialPolicyRuleForm(rule, profileId, defaultTaxRegimeId),
  )
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!rule

  useEffect(() => {
    setForm(initialPolicyRuleForm(rule, profileId, defaultTaxRegimeId))
    setError(null)
  }, [defaultTaxRegimeId, profileId, rule])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.profileId) throw new Error(taxMessages.validationPolicyProfileRequired)
      if (!form.name.trim()) throw new Error(taxMessages.validationPolicyRuleNameRequired)
      if (!form.taxRegimeId) throw new Error(taxMessages.validationPolicyRuleRegimeRequired)
      const priority = Number(form.priority)
      if (!Number.isInteger(priority) || priority < 0) {
        throw new Error(taxMessages.validationPolicyRulePriorityInvalid)
      }

      const condition = buildPolicyCondition(form, taxMessages)

      const input = {
        profileId: form.profileId,
        side: form.side,
        priority,
        name: form.name.trim(),
        appliesTo: form.appliesTo,
        condition,
        taxRegimeId: form.taxRegimeId,
        active: form.active,
      }

      if (rule) {
        await api.patch(`/v1/finance/tax-policy-rules/${rule.id}`, input)
      } else {
        await api.post("/v1/finance/tax-policy-rules", input)
      }
    },
    onSuccess,
    onError: (err) =>
      setError(err instanceof Error ? err.message : taxMessages.savePolicyRuleFailed),
  })

  const setField =
    <K extends keyof PolicyRuleFormState>(key: K) =>
    (value: PolicyRuleFormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }))

  const updateCondition = (
    index: number,
    patch: Partial<PolicyRuleFormState["conditions"][number]>,
  ) => {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? normalizeCondition({ ...condition, ...patch }) : condition,
      ),
    }))
  }

  const addCondition = () => {
    setForm((current) => ({
      ...current,
      conditionMode: current.conditionMode === "always" ? "all" : current.conditionMode,
      conditions: [
        ...current.conditions,
        {
          key: nextTaxPolicyConditionKey(),
          fact: "hasAccommodation",
          operator: "eq",
          value: "true",
        },
      ],
    }))
  }

  const removeCondition = (index: number) => {
    setForm((current) => {
      const conditions = current.conditions.filter((_, conditionIndex) => conditionIndex !== index)
      return {
        ...current,
        conditions,
        conditionMode: conditions.length ? current.conditionMode : "always",
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? taxMessages.editPolicyRuleSheetTitle : taxMessages.newPolicyRuleSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policyRuleNameLabel}</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setField("name")(event.target.value)}
                  placeholder={taxMessages.policyRuleNamePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policyPriorityLabel}</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.priority}
                  onChange={(event) => setField("priority")(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policySideLabel}</Label>
                <Select
                  value={form.side}
                  onValueChange={(value) => setField("side")(value as TaxPolicySide)}
                  items={[
                    { value: "sell", label: taxMessages.policySideSell },
                    { value: "buy", label: taxMessages.policySideBuy },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sell">{taxMessages.policySideSell}</SelectItem>
                    <SelectItem value="buy">{taxMessages.policySideBuy}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.appliesToLabel}</Label>
                <Select
                  value={form.appliesTo}
                  onValueChange={(value) => setField("appliesTo")(value as TaxClassAppliesTo)}
                  items={TAX_CLASS_APPLIES_TO_OPTIONS.map((appliesTo) => ({
                    value: appliesTo,
                    label: appliesToLabel(messages, appliesTo),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_CLASS_APPLIES_TO_OPTIONS.map((appliesTo) => (
                      <SelectItem key={appliesTo} value={appliesTo}>
                        {appliesToLabel(messages, appliesTo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{taxMessages.taxRegimeLabel}</Label>
                <Select
                  value={form.taxRegimeId}
                  onValueChange={(value) => setField("taxRegimeId")(value ?? "")}
                  items={taxRegimes.map((regime) => ({
                    value: regime.id,
                    label: `${regime.name} (${formatRate(regime.ratePercent)})`,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxRegimes.map((regime) => (
                      <SelectItem key={regime.id} value={regime.id}>
                        {regime.name} ({formatRate(regime.ratePercent)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium">{taxMessages.policyConditionSectionTitle}</h3>
                  <p className="text-xs text-muted-foreground">
                    {taxMessages.policyConditionSectionDescription}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCondition}
                  disabled={form.conditionMode === "always"}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {taxMessages.addPolicyCondition}
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{taxMessages.policyConditionModeLabel}</Label>
                <Select
                  value={form.conditionMode}
                  onValueChange={(value) => {
                    const conditionMode = value as TaxPolicyConditionMode
                    setForm((current) => ({
                      ...current,
                      conditionMode,
                      conditions:
                        conditionMode === "always"
                          ? []
                          : current.conditions.length
                            ? current.conditions
                            : [
                                {
                                  key: nextTaxPolicyConditionKey(),
                                  fact: "hasAccommodation",
                                  operator: "eq",
                                  value: "true",
                                },
                              ],
                    }))
                  }}
                  items={[
                    { value: "always", label: taxMessages.policyConditionAlways },
                    { value: "all", label: taxMessages.policyConditionModeAll },
                    { value: "any", label: taxMessages.policyConditionModeAny },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">{taxMessages.policyConditionAlways}</SelectItem>
                    <SelectItem value="all">{taxMessages.policyConditionModeAll}</SelectItem>
                    <SelectItem value="any">{taxMessages.policyConditionModeAny}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.conditionMode === "always" ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {taxMessages.policyConditionAlwaysDescription}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {form.conditions.map((condition, index) => (
                    <div
                      key={condition.key}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
                    >
                      <div className="flex flex-col gap-2">
                        <Label>{taxMessages.policyFactLabel}</Label>
                        <Select
                          value={condition.fact}
                          onValueChange={(value) =>
                            updateCondition(index, {
                              fact: value as TaxPolicyConditionFact,
                            })
                          }
                          items={TAX_POLICY_CONDITION_FACT_OPTIONS.map((fact) => ({
                            value: fact,
                            label:
                              fact === "hasAccommodation"
                                ? taxMessages.policyFactHasAccommodation
                                : taxMessages.policyFactAccommodationCountries,
                          }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hasAccommodation">
                              {taxMessages.policyFactHasAccommodation}
                            </SelectItem>
                            <SelectItem value="accommodationCountries">
                              {taxMessages.policyFactAccommodationCountries}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>{taxMessages.policyOperatorLabel}</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            updateCondition(index, {
                              operator: value as TaxPolicyConditionOperator,
                            })
                          }
                          items={[
                            {
                              value: condition.fact === "hasAccommodation" ? "eq" : "contains",
                              label:
                                condition.fact === "hasAccommodation"
                                  ? taxMessages.policyOperatorEquals
                                  : taxMessages.policyOperatorContains,
                            },
                          ]}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {condition.fact === "hasAccommodation" ? (
                              <SelectItem value="eq">{taxMessages.policyOperatorEquals}</SelectItem>
                            ) : (
                              <SelectItem value="contains">
                                {taxMessages.policyOperatorContains}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>{taxMessages.policyValueLabel}</Label>
                        {condition.fact === "hasAccommodation" ? (
                          <Select
                            value={condition.value}
                            onValueChange={(value) =>
                              updateCondition(index, { value: value ?? "true" })
                            }
                            items={[
                              { value: "true", label: taxMessages.policyValueYes },
                              { value: "false", label: taxMessages.policyValueNo },
                            ]}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">{taxMessages.policyValueYes}</SelectItem>
                              <SelectItem value="false">{taxMessages.policyValueNo}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={condition.value}
                            maxLength={2}
                            onChange={(event) =>
                              updateCondition(index, { value: event.target.value.toUpperCase() })
                            }
                            placeholder="RO"
                          />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(index)}
                        aria-label={taxMessages.removePolicyCondition}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={setField("active")} />
              <Label>{taxMessages.activeLabel}</Label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {taxMessages.cancel}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? taxMessages.saveChanges : taxMessages.createPolicyRule}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
