"use client"

import {
  type CreateOrganizationInput,
  type OrganizationRecord,
  useOrganizationMutation,
} from "@voyantjs/crm-react"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"

type Mode = { kind: "create" } | { kind: "edit"; organization: OrganizationRecord }

export interface OrganizationFormProps {
  mode: Mode
  onSuccess?: (organization: OrganizationRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  legalName: string
  website: string
  industry: string
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const org = mode.organization
    return {
      name: org.name,
      legalName: org.legalName ?? "",
      website: org.website ?? "",
      industry: org.industry ?? "",
    }
  }

  return {
    name: "",
    legalName: "",
    website: "",
    industry: "",
  }
}

function toPayload(state: FormState): CreateOrganizationInput {
  return {
    name: state.name.trim(),
    legalName: state.legalName.trim() || null,
    website: state.website.trim() || null,
    industry: state.industry.trim() || null,
  }
}

export function OrganizationForm({ mode, onSuccess, onCancel }: OrganizationFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useOrganizationMutation()
  const messages = useCrmUiMessagesOrDefault()

  const isSubmitting = create.isPending || update.isPending

  const field =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({ ...prev, [key]: e.target.value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(messages.organizationForm.validation.nameRequired)
      return
    }

    const payload = toPayload(state)

    try {
      const organization =
        mode.kind === "create"
          ? await create.mutateAsync(payload)
          : await update.mutateAsync({ id: mode.organization.id, input: payload })
      onSuccess?.(organization)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.organizationForm.validation.saveFailed)
    }
  }

  return (
    <form data-slot="organization-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="organization-name">{messages.organizationForm.fields.name}</Label>
          <Input id="organization-name" required value={state.name} onChange={field("name")} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="organization-legal-name">
            {messages.organizationForm.fields.legalName}
          </Label>
          <Input
            id="organization-legal-name"
            value={state.legalName}
            onChange={field("legalName")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organization-website">{messages.organizationForm.fields.website}</Label>
          <Input
            id="organization-website"
            type="url"
            value={state.website}
            onChange={field("website")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organization-industry">{messages.organizationForm.fields.industry}</Label>
          <Input id="organization-industry" value={state.industry} onChange={field("industry")} />
        </div>
      </div>

      {error ? (
        <p data-slot="organization-form-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {messages.common.saving}
            </>
          ) : mode.kind === "create" ? (
            messages.organizationForm.actions.create
          ) : (
            messages.common.saveChanges
          )}
        </Button>
      </div>
    </form>
  )
}
