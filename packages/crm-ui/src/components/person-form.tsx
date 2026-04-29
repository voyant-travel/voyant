"use client"

import { type CreatePersonInput, type PersonRecord, usePersonMutation } from "@voyantjs/crm-react"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useCrmUiMessagesOrDefault } from "../i18n"

type Mode = { kind: "create" } | { kind: "edit"; person: PersonRecord }

export interface PersonFormProps {
  mode: Mode
  onSuccess?: (person: PersonRecord) => void
  onCancel?: () => void
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const p = mode.person
    return {
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      jobTitle: p.jobTitle ?? "",
    }
  }
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
  }
}

function toPayload(state: FormState): CreatePersonInput {
  return {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    email: state.email.trim() || null,
    phone: state.phone.trim() || null,
    jobTitle: state.jobTitle.trim() || null,
  }
}

/**
 * Create/edit form for a Person. Validates via the server-side Zod schema
 * exposed on `/api/v1/crm/people` — client-side errors surface as toast-
 * friendly `VoyantApiError`s inside the mutation.
 */
export function PersonForm({ mode, onSuccess, onCancel }: PersonFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = usePersonMutation()
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

    if (!state.firstName.trim() || !state.lastName.trim()) {
      setError(messages.personForm.validation.nameRequired)
      return
    }

    const payload = toPayload(state)

    try {
      const person =
        mode.kind === "create"
          ? await create.mutateAsync(payload)
          : await update.mutateAsync({ id: mode.person.id, input: payload })
      onSuccess?.(person)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.personForm.validation.saveFailed)
    }
  }

  return (
    <form data-slot="person-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-first-name">{messages.personForm.fields.firstName}</Label>
          <Input
            id="person-first-name"
            required
            value={state.firstName}
            onChange={field("firstName")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-last-name">{messages.personForm.fields.lastName}</Label>
          <Input
            id="person-last-name"
            required
            value={state.lastName}
            onChange={field("lastName")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="person-job-title">{messages.personForm.fields.jobTitle}</Label>
          <Input id="person-job-title" value={state.jobTitle} onChange={field("jobTitle")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-email">{messages.personForm.fields.email}</Label>
          <Input id="person-email" type="email" value={state.email} onChange={field("email")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-phone">{messages.personForm.fields.phone}</Label>
          <Input id="person-phone" value={state.phone} onChange={field("phone")} />
        </div>
      </div>

      {error ? (
        <p data-slot="person-form-error" className="text-sm text-destructive">
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
            messages.personForm.actions.create
          ) : (
            messages.common.saveChanges
          )}
        </Button>
      </div>
    </form>
  )
}
