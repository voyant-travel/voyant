"use client"

import {
  type CurrentUser,
  type UpdateAccountProfileInput,
  useUpdateAccountProfile,
} from "@voyantjs/auth-react"
import { Button, cn, Input, Label } from "@voyantjs/ui/components"
import { CheckCircle2, Loader2 } from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useState } from "react"

export interface OnboardingPageMessages {
  title: string
  description: string
  firstNameLabel: string
  firstNamePlaceholder: string
  lastNameLabel: string
  lastNamePlaceholder: string
  localeLabel: string
  localePlaceholder: string
  timezoneLabel: string
  timezonePlaceholder: string
  firstNameRequired: string
  lastNameRequired: string
  submit: string
  submitting: string
  somethingWentWrong: string
}

export interface OnboardingPageSlots {
  beforeFields?: ReactNode
  afterFields?: ReactNode
  footer?: ReactNode
}

export interface OnboardingPageInitialProfile {
  firstName?: string | null
  lastName?: string | null
  locale?: string | null
  timezone?: string | null
}

export interface OnboardingPageProps {
  className?: string
  initialProfile?: OnboardingPageInitialProfile | null
  messages?: Partial<OnboardingPageMessages>
  showLocale?: boolean
  showTimezone?: boolean
  slots?: OnboardingPageSlots
  onCompleted?: (profile: CurrentUser) => Promise<void> | void
}

export const defaultOnboardingPageMessages: OnboardingPageMessages = {
  title: "Complete your profile",
  description: "Add the basic account details your team will see in Voyant.",
  firstNameLabel: "First name",
  firstNamePlaceholder: "Ana",
  lastNameLabel: "Last name",
  lastNamePlaceholder: "Pop",
  localeLabel: "Locale",
  localePlaceholder: "en",
  timezoneLabel: "Timezone",
  timezonePlaceholder: "Europe/Bucharest",
  firstNameRequired: "First name is required.",
  lastNameRequired: "Last name is required.",
  submit: "Continue",
  submitting: "Saving",
  somethingWentWrong: "Something went wrong. Try again.",
}

export function OnboardingPage({
  className,
  initialProfile,
  messages: messageOverrides,
  showLocale = true,
  showTimezone = true,
  slots,
  onCompleted,
}: OnboardingPageProps) {
  const messages = useMemo(
    () => ({ ...defaultOnboardingPageMessages, ...messageOverrides }),
    [messageOverrides],
  )
  const updateProfile = useUpdateAccountProfile()
  const [firstName, setFirstName] = useState(initialProfile?.firstName ?? "")
  const [lastName, setLastName] = useState(initialProfile?.lastName ?? "")
  const [locale, setLocale] = useState(initialProfile?.locale ?? "en")
  const [timezone, setTimezone] = useState(initialProfile?.timezone ?? "")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedLocale = locale.trim()
    const trimmedTimezone = timezone.trim()

    if (!trimmedFirstName) {
      setError(messages.firstNameRequired)
      return
    }

    if (!trimmedLastName) {
      setError(messages.lastNameRequired)
      return
    }

    const input: UpdateAccountProfileInput = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
    }

    if (showLocale) {
      input.locale = trimmedLocale || null
    }

    if (showTimezone) {
      input.timezone = trimmedTimezone || null
    }

    try {
      const profile = await updateProfile.mutateAsync(input)
      await onCompleted?.(profile)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : messages.somethingWentWrong)
    }
  }

  return (
    <div
      data-slot="onboarding-page"
      className={cn("mx-auto flex w-full max-w-xl flex-col gap-6", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {slots?.beforeFields}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="auth-onboarding-first-name">{messages.firstNameLabel}</Label>
            <Input
              id="auth-onboarding-first-name"
              value={firstName}
              placeholder={messages.firstNamePlaceholder}
              onChange={(event) => setFirstName(event.target.value)}
              required
              autoComplete="given-name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-onboarding-last-name">{messages.lastNameLabel}</Label>
            <Input
              id="auth-onboarding-last-name"
              value={lastName}
              placeholder={messages.lastNamePlaceholder}
              onChange={(event) => setLastName(event.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        {(showLocale || showTimezone) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {showLocale && (
              <div className="space-y-2">
                <Label htmlFor="auth-onboarding-locale">{messages.localeLabel}</Label>
                <Input
                  id="auth-onboarding-locale"
                  value={locale}
                  placeholder={messages.localePlaceholder}
                  onChange={(event) => setLocale(event.target.value)}
                  autoComplete="language"
                />
              </div>
            )}

            {showTimezone && (
              <div className="space-y-2">
                <Label htmlFor="auth-onboarding-timezone">{messages.timezoneLabel}</Label>
                <Input
                  id="auth-onboarding-timezone"
                  value={timezone}
                  placeholder={messages.timezonePlaceholder}
                  onChange={(event) => setTimezone(event.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {slots?.afterFields}

        <Button type="submit" className="w-full sm:w-auto" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {updateProfile.isPending ? messages.submitting : messages.submit}
        </Button>

        {slots?.footer}
      </form>
    </div>
  )
}
