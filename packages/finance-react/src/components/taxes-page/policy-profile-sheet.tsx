"use client"

import { useMutation } from "@tanstack/react-query"
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../../i18n/index.js"
import type { PolicyProfileFormState, TaxPolicyProfileRecord } from "./shared.js"
import { initialPolicyProfileForm, toSlug, useTaxesPageApi } from "./shared.js"

export function PolicyProfileSheet({
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
        await api.patch(`/v1/admin/finance/tax-policy-profiles/${profile.id}`, input)
      } else {
        await api.post("/v1/admin/finance/tax-policy-profiles", input)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
