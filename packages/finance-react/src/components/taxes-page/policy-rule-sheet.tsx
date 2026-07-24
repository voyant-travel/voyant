"use client"

import { useMutation } from "@tanstack/react-query"
import {
  Button,
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
} from "@voyant-travel/ui/components"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../../i18n/index.js"
import type {
  PolicyRuleFormState,
  TaxClassAppliesTo,
  TaxPolicyConditionFact,
  TaxPolicyConditionMode,
  TaxPolicyConditionOperator,
  TaxPolicyRuleRecord,
  TaxPolicySide,
  TaxRegimeRecord,
} from "./shared.js"
import {
  appliesToLabel,
  buildPolicyCondition,
  formatRate,
  initialPolicyRuleForm,
  nextTaxPolicyConditionKey,
  normalizeCondition,
  TAX_CLASS_APPLIES_TO_OPTIONS,
  TAX_POLICY_CONDITION_FACT_OPTIONS,
  useTaxesPageApi,
} from "./shared.js"

export function PolicyRuleSheet({
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
        await api.patch(`/v1/admin/finance/tax-policy-rules/${rule.id}`, input)
      } else {
        await api.post("/v1/admin/finance/tax-policy-rules", input)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
