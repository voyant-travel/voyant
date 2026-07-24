"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  StorefrontCustomerAccountPolicy,
  StorefrontCustomerAuthMethods,
  StorefrontDto,
  StorefrontSocialProvider,
} from "@voyant-travel/auth/storefront-admin-contracts"
import {
  Badge,
  Button,
  Checkbox,
  cn,
  confirmDialog,
  Input,
  Label,
  Switch,
} from "@voyant-travel/ui/components"
import { useMemo, useState } from "react"

import type { StorefrontsPageMessages } from "../i18n/messages.js"
import { useAuthUiI18nOrDefault } from "../i18n/provider.js"
import { authQueryKeys } from "../query-keys.js"
import {
  type StorefrontsAdminApi,
  storefrontProviderCredentialsQueryOptions,
} from "../storefronts-admin-api.js"

const SOCIAL_PROVIDERS: readonly StorefrontSocialProvider[] = ["google", "facebook", "apple"]
const METHOD_KEYS: readonly (keyof StorefrontCustomerAuthMethods)[] = [
  "emailCode",
  "emailPassword",
  "google",
  "facebook",
  "apple",
]

export function AccountSection({
  api,
  storefront,
  businessAccounts,
  onError,
}: {
  api: StorefrontsAdminApi
  storefront: StorefrontDto
  businessAccounts: boolean
  onError: (error: string | null) => void
}) {
  const queryClient = useQueryClient()
  const copy = useAuthUiI18nOrDefault().messages.storefrontsPage
  const [methods, setMethods] = useState<StorefrontCustomerAuthMethods>(storefront.methods)
  const [policy, setPolicy] = useState<StorefrontCustomerAccountPolicy>(storefront.accountPolicy)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: authQueryKeys.storefrontList() })

  const saveMethods = useMutation({
    mutationFn: () => api.updateMethods(storefront.id, methods),
    onSuccess: () => {
      onError(null)
      void invalidate()
    },
    onError: (error) => onError(error instanceof Error ? error.message : copy.actionFailed),
  })
  const savePolicy = useMutation({
    mutationFn: () => api.updateAccountPolicy(storefront.id, policy),
    onSuccess: () => {
      onError(null)
      void invalidate()
    },
    onError: (error) => onError(error instanceof Error ? error.message : copy.actionFailed),
  })

  const methodLabels = useMemo<Record<keyof StorefrontCustomerAuthMethods, string>>(
    () => ({
      emailCode: copy.account.methodEmailCode,
      emailPassword: copy.account.methodEmailPassword,
      google: copy.account.methodGoogle,
      facebook: copy.account.methodFacebook,
      apple: copy.account.methodApple,
    }),
    [copy.account],
  )

  const allowsPersonal = policy.allowedKinds.includes("personal")
  const allowsBusiness = policy.allowedKinds.includes("business")

  const setAllowed = (kind: "personal" | "business", checked: boolean) => {
    setPolicy((current) => {
      const kinds = new Set(current.allowedKinds)
      if (checked) kinds.add(kind)
      else kinds.delete(kind)
      const allowedKinds = (["personal", "business"] as const).filter((entry) => kinds.has(entry))
      return {
        allowedKinds: allowedKinds.length > 0 ? allowedKinds : ["personal"],
        // Keep the persisted invariants satisfied so the save is never rejected.
        personalSignup: allowedKinds.includes("personal") ? current.personalSignup : "disabled",
        businessOnboarding: allowedKinds.includes("business")
          ? current.businessOnboarding === "disabled"
            ? "request"
            : current.businessOnboarding
          : "disabled",
      }
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{copy.account.methodsTitle}</h3>
          <p className="text-xs text-muted-foreground">{copy.account.methodsDescription}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHOD_KEYS.map((key) => (
            <label
              key={key}
              htmlFor={`method-${storefront.id}-${key}`}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
            >
              <Checkbox
                id={`method-${storefront.id}-${key}`}
                checked={methods[key]}
                onCheckedChange={(value) =>
                  setMethods((current) => ({ ...current, [key]: value === true }))
                }
              />
              {methodLabels[key]}
            </label>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saveMethods.isPending}
          onClick={() => saveMethods.mutate()}
        >
          {saveMethods.isPending ? copy.account.saving : copy.account.saveMethods}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{copy.account.policyTitle}</h3>
          <p className="text-xs text-muted-foreground">{copy.account.policyDescription}</p>
        </div>
        <div className="flex flex-col gap-3">
          <label
            htmlFor={`allow-personal-${storefront.id}`}
            className="flex items-center justify-between rounded-md border p-2 text-sm"
          >
            {copy.account.allowPersonal}
            <Switch
              id={`allow-personal-${storefront.id}`}
              checked={allowsPersonal}
              onCheckedChange={(value) => setAllowed("personal", value)}
            />
          </label>
          {allowsPersonal ? (
            <div className="grid gap-2">
              <Label htmlFor={`personal-signup-${storefront.id}`}>
                {copy.account.personalSignup}
              </Label>
              <select
                id={`personal-signup-${storefront.id}`}
                value={policy.personalSignup}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    personalSignup: event.target
                      .value as StorefrontCustomerAccountPolicy["personalSignup"],
                  }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="open">{copy.account.personalSignupOpen}</option>
                <option value="disabled">{copy.account.personalSignupDisabled}</option>
              </select>
            </div>
          ) : null}

          <label
            htmlFor={`allow-business-${storefront.id}`}
            className={cn(
              "flex items-center justify-between rounded-md border p-2 text-sm",
              !businessAccounts && "opacity-60",
            )}
          >
            {copy.account.allowBusiness}
            <Switch
              id={`allow-business-${storefront.id}`}
              checked={allowsBusiness}
              disabled={!businessAccounts}
              onCheckedChange={(value) => setAllowed("business", value)}
            />
          </label>
          {!businessAccounts ? (
            <p className="text-xs text-muted-foreground">{copy.businessUnsupported}</p>
          ) : allowsBusiness ? (
            <div className="grid gap-2">
              <Label htmlFor={`business-onboarding-${storefront.id}`}>
                {copy.account.businessOnboarding}
              </Label>
              <select
                id={`business-onboarding-${storefront.id}`}
                value={policy.businessOnboarding}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    businessOnboarding: event.target
                      .value as StorefrontCustomerAccountPolicy["businessOnboarding"],
                  }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="open">{copy.account.businessOnboardingOpen}</option>
                <option value="request">{copy.account.businessOnboardingRequest}</option>
                <option value="invite-only">{copy.account.businessOnboardingInviteOnly}</option>
              </select>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={savePolicy.isPending}
          onClick={() => savePolicy.mutate()}
        >
          {savePolicy.isPending ? copy.account.saving : copy.account.savePolicy}
        </Button>
      </div>
    </section>
  )
}

export function ProvidersSection({
  api,
  storefront,
  manageProviders,
  onError,
}: {
  api: StorefrontsAdminApi
  storefront: StorefrontDto
  manageProviders: boolean
  onError: (error: string | null) => void
}) {
  const copy = useAuthUiI18nOrDefault().messages.storefrontsPage.providers
  const credentialsQuery = useQuery(storefrontProviderCredentialsQueryOptions(api, storefront.id))

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{copy.title}</h3>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>
      <div className="space-y-3">
        {SOCIAL_PROVIDERS.map((provider) => (
          <ProviderCredentialRow
            key={provider}
            api={api}
            storefrontId={storefront.id}
            provider={provider}
            configured={
              credentialsQuery.data?.find((entry) => entry.provider === provider)?.configured ??
              false
            }
            disabled={!manageProviders}
            onError={onError}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{copy.secretHint}</p>
    </section>
  )
}

function providerLabel(
  copy: StorefrontsPageMessages["providers"],
  provider: StorefrontSocialProvider,
): string {
  if (provider === "google") return copy.providerGoogle
  if (provider === "facebook") return copy.providerFacebook
  return copy.providerApple
}

function ProviderCredentialRow({
  api,
  storefrontId,
  provider,
  configured,
  disabled,
  onError,
}: {
  api: StorefrontsAdminApi
  storefrontId: string
  provider: StorefrontSocialProvider
  configured: boolean
  disabled: boolean
  onError: (error: string | null) => void
}) {
  const queryClient = useQueryClient()
  const { messages } = useAuthUiI18nOrDefault()
  const copy = messages.storefrontsPage.providers
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: authQueryKeys.storefrontProviderCredentials(storefrontId),
    })

  const save = useMutation({
    mutationFn: () =>
      api.putProviderCredential(storefrontId, provider, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      }),
    onSuccess: () => {
      onError(null)
      setClientId("")
      setClientSecret("")
      void invalidate()
    },
    onError: (error) => onError(error instanceof Error ? error.message : copy.title),
  })
  const clear = useMutation({
    mutationFn: () => api.deleteProviderCredential(storefrontId, provider),
    onSuccess: () => {
      onError(null)
      void invalidate()
    },
    onError: (error) => onError(error instanceof Error ? error.message : copy.title),
  })

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{providerLabel(copy, provider)}</span>
        <Badge variant={configured ? "default" : "secondary"}>
          {configured ? copy.configured : copy.notConfigured}
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          value={clientId}
          placeholder={copy.clientIdLabel}
          aria-label={`${providerLabel(copy, provider)} ${copy.clientIdLabel}`}
          disabled={disabled}
          onChange={(event) => setClientId(event.target.value)}
        />
        <Input
          type="password"
          value={clientSecret}
          placeholder={copy.clientSecretLabel}
          aria-label={`${providerLabel(copy, provider)} ${copy.clientSecretLabel}`}
          disabled={disabled}
          onChange={(event) => setClientSecret(event.target.value)}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || save.isPending || !clientId.trim() || !clientSecret.trim()}
          onClick={() => save.mutate()}
        >
          {copy.save}
        </Button>
        {configured ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || clear.isPending}
            onClick={async () => {
              if (!(await confirmDialog({ description: copy.clearConfirm, destructive: true })))
                return
              clear.mutate()
            }}
          >
            {copy.clear}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
