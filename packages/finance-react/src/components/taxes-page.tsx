"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { useVoyantFinanceContext } from "../index.js"
import type {
  TaxClassRecord,
  TaxesPageApi,
  TaxesPageProps,
  TaxPolicyProfileRecord,
  TaxPolicyRuleRecord,
  TaxRegimeRecord,
  TaxRow,
} from "./taxes-page/shared.js"
import {
  appliesToLabel,
  createTaxesPageApi,
  formatRate,
  summarizeCondition,
  TaxesPageApiContext,
} from "./taxes-page/shared.js"
import { PolicyProfileSheet, PolicyRuleSheet, TaxSheet } from "./taxes-page/sheets.js"

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
      api.get<{ data: TaxClassRecord[]; total: number }>("/v1/admin/finance/tax-classes?limit=100"),
  })
  const taxRegimesQuery = useQuery({
    queryKey: ["tax-regimes"],
    queryFn: () =>
      api.get<{ data: TaxRegimeRecord[]; total: number }>(
        "/v1/admin/finance/tax-regimes?limit=100",
      ),
  })
  const policyProfilesQuery = useQuery({
    queryKey: ["tax-policy-profiles"],
    queryFn: () =>
      api.get<{ data: TaxPolicyProfileRecord[]; total: number }>(
        "/v1/admin/finance/tax-policy-profiles?limit=100",
      ),
  })
  const policyRulesQuery = useQuery({
    queryKey: ["tax-policy-rules"],
    queryFn: () =>
      api.get<{ data: TaxPolicyRuleRecord[]; total: number }>(
        "/v1/admin/finance/tax-policy-rules?limit=100",
      ),
  })
  const invoicingSettingsQuery = useQuery({
    queryKey: ["booking-tax-settings"],
    queryFn: () =>
      api.get<{ data: { invoicingMode: "direct" | "proforma-first" } }>(
        "/v1/admin/bookings/tax-settings",
      ),
  })
  const invoicingModeMutation = useMutation({
    mutationFn: (invoicingMode: "direct" | "proforma-first") =>
      api.patch("/v1/admin/bookings/tax-settings", { invoicingMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["booking-tax-settings"] })
    },
  })
  const invoicingMode = invoicingSettingsQuery.data?.data.invoicingMode ?? "direct"

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
      await api.delete(`/v1/admin/finance/tax-classes/${row.taxClass.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-classes"] })
    },
  })
  const deleteProfileMutation = useMutation({
    mutationFn: async (profile: TaxPolicyProfileRecord) => {
      const rules = policyRulesByProfileId.get(profile.id) ?? []
      await Promise.all(
        rules.map((rule) => api.delete(`/v1/admin/finance/tax-policy-rules/${rule.id}`)),
      )
      await api.delete(`/v1/admin/finance/tax-policy-profiles/${profile.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-profiles"] })
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-rules"] })
    },
  })
  const deleteRuleMutation = useMutation({
    mutationFn: async (rule: TaxPolicyRuleRecord) => {
      await api.delete(`/v1/admin/finance/tax-policy-rules/${rule.id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tax-policy-rules"] })
    },
  })

  return (
    <TaxesPageApiContext.Provider value={api}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-3 rounded-md border bg-card p-6 text-card-foreground shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {taxMessages.invoicingModeTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{taxMessages.invoicingModeDescription}</p>
          </div>
          <div className="max-w-sm">
            <Select
              value={invoicingMode}
              onValueChange={(value) => {
                if (value === "direct" || value === "proforma-first") {
                  invoicingModeMutation.mutate(value)
                }
              }}
              disabled={invoicingSettingsQuery.isPending || invoicingModeMutation.isPending}
            >
              <SelectTrigger id="invoicing-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">{taxMessages.invoicingModeDirect}</SelectItem>
                <SelectItem value="proforma-first">
                  {taxMessages.invoicingModeProformaFirst}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {invoicingMode === "proforma-first"
                ? taxMessages.invoicingModeProformaFirstHint
                : taxMessages.invoicingModeDirectHint}
            </p>
          </div>
        </div>
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
          <div className="rounded-md border bg-card text-card-foreground shadow-sm">
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
          <div className="rounded-md border bg-card text-card-foreground shadow-sm">
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
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: finance-react; existing suppression is intentional pending typed cleanup.
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

export type { TaxesPageApi, TaxesPageProps } from "./taxes-page/shared.js"
