"use client"

import {
  type ApiToken,
  type ApiTokenWithSecret,
  useApiTokenMutation,
  useApiTokens,
} from "@voyantjs/auth-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  API_KEY_PERMISSION_GROUPS,
  API_KEY_PERMISSION_PRESETS,
  type ApiKeyPermissions,
  describePermissions,
  hasApiKeyPermission,
  permissionsToStrings,
} from "@voyantjs/types/api-keys"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  Input,
  Label,
} from "@voyantjs/ui/components"
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"

import { useAuthUiMessagesOrDefault } from "../i18n/provider.js"

export interface ServiceApiKeysPageProps {
  className?: string
  pageSize?: number
  title?: string
  description?: string
}

export type ApiTokensPageProps = ServiceApiKeysPageProps

function expiresInSeconds(days: number | null): number | null {
  return days === null ? null : days * 24 * 60 * 60
}

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  )
}

function permissionLabel(permission: string, fullAccessLabel: string): string {
  if (permission === "*") return fullAccessLabel
  const [resource, action] = permission.split(":")
  return `${resource ?? permission}:${action ?? ""}`
}

function togglePermission(
  permissions: ApiKeyPermissions,
  resource: string,
  action: string,
  checked: boolean,
): ApiKeyPermissions {
  const current = new Set(permissions[resource] ?? [])
  if (checked) {
    current.add(action)
  } else {
    current.delete(action)
  }

  const next = { ...permissions }
  if (current.size === 0) {
    delete next[resource]
  } else {
    next[resource] = Array.from(current).sort()
  }
  return next
}

function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null)

  return {
    copied,
    copy: async (id: string, value: string) => {
      await navigator.clipboard.writeText(value)
      setCopied(id)
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000)
    },
  }
}

export function ServiceApiKeysPage({
  className,
  pageSize = 25,
  title,
  description,
}: ServiceApiKeysPageProps) {
  const messages = useAuthUiMessagesOrDefault().serviceApiKeysPage
  const pageTitle = title ?? messages.title
  const pageDescription = description ?? messages.description
  const expirationOptions = [
    { label: messages.create.expirationOptions.never, days: null },
    { label: messages.create.expirationOptions.sevenDays, days: 7 },
    { label: messages.create.expirationOptions.thirtyDays, days: 30 },
    { label: messages.create.expirationOptions.ninetyDays, days: 90 },
    { label: messages.create.expirationOptions.oneYear, days: 365 },
  ] as const
  const keys = useApiTokens({ limit: pageSize, sortBy: "createdAt", sortDirection: "desc" })
  const mutations = useApiTokenMutation()
  const clipboard = useClipboard()

  const [name, setName] = useState("")
  const [expirationDays, setExpirationDays] = useState<number | null>(90)
  const [selectedPermissions, setSelectedPermissions] = useState<ApiKeyPermissions>({
    ...API_KEY_PERMISSION_PRESETS["catalog-read"].permissions,
  })
  const [createdKey, setCreatedKey] = useState<ApiTokenWithSecret | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDescription = useMemo(
    () => describePermissions(selectedPermissions),
    [selectedPermissions],
  )

  const onTogglePermission = (resource: string, action: string, checked: boolean) => {
    setSelectedPermissions((current) => togglePermission(current, resource, action, checked))
  }

  const applyPreset = (preset: keyof typeof API_KEY_PERMISSION_PRESETS) => {
    setSelectedPermissions({ ...API_KEY_PERMISSION_PRESETS[preset].permissions })
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setCreatedKey(null)

    if (!name.trim()) {
      setError(messages.create.errors.nameRequired)
      return
    }

    if (permissionsToStrings(selectedPermissions).length === 0) {
      setError(messages.create.errors.permissionRequired)
      return
    }

    try {
      const result = await mutations.create.mutateAsync({
        name: name.trim(),
        permissions: selectedPermissions,
        expiresIn: expiresInSeconds(expirationDays),
      })
      setCreatedKey(result)
      setName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.create.errors.createFailed)
    }
  }

  return (
    <div data-slot="api-tokens-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      {createdKey && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              {messages.createdToken.title}
            </CardTitle>
            <CardDescription>{messages.createdToken.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input value={createdKey.key} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              onClick={() => void clipboard.copy(createdKey.id, createdKey.key)}
            >
              {clipboard.copied === createdKey.id ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {messages.createdToken.copy}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{messages.create.title}</CardTitle>
          <CardDescription>{selectedDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <Label htmlFor="api-token-name">{messages.create.name}</Label>
                <Input
                  id="api-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={messages.create.namePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-token-expiration">{messages.create.expiration}</Label>
                <select
                  id="api-token-expiration"
                  value={expirationDays ?? "never"}
                  onChange={(event) =>
                    setExpirationDays(
                      event.target.value === "never" ? null : Number(event.target.value),
                    )
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {expirationOptions.map((option) => (
                    <option key={option.label} value={option.days ?? "never"}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                Object.keys(API_KEY_PERMISSION_PRESETS) as Array<
                  keyof typeof API_KEY_PERMISSION_PRESETS
                >
              ).map((key) => (
                <Button key={key} type="button" variant="outline" onClick={() => applyPreset(key)}>
                  {API_KEY_PERMISSION_PRESETS[key].label}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {API_KEY_PERMISSION_GROUPS.map((group) => (
                <div key={group.resource} className="rounded-md border p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-medium">{group.label}</h2>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="space-y-3">
                    {group.permissions.map((descriptor) => {
                      const checked = hasApiKeyPermission(
                        selectedPermissions,
                        descriptor.resource,
                        descriptor.action,
                      )
                      const permissionId = `permission-${descriptor.resource}-${descriptor.action}`
                      return (
                        <label
                          key={`${descriptor.resource}:${descriptor.action}`}
                          htmlFor={permissionId}
                          className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/60"
                        >
                          <Checkbox
                            id={permissionId}
                            checked={checked}
                            onCheckedChange={(value) =>
                              onTogglePermission(
                                descriptor.resource,
                                descriptor.action,
                                value === true,
                              )
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{descriptor.label}</span>
                            <span className="block text-xs text-muted-foreground">
                              {descriptor.description}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Button type="submit" disabled={mutations.create.isPending}>
                {mutations.create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {messages.create.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{messages.list.title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void keys.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {messages.list.refresh}
        </Button>
      </div>

      {keys.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {messages.list.loading}
          </CardContent>
        </Card>
      ) : keys.data?.apiKeys.length ? (
        <div className="space-y-3">
          {keys.data.apiKeys.map((key) => (
            <ServiceApiKeyRow key={key.id} apiKey={key} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {messages.list.empty}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const ApiTokensPage = ServiceApiKeysPage

function ServiceApiKeyRow({ apiKey }: { apiKey: ApiToken }) {
  const messages = useAuthUiMessagesOrDefault().serviceApiKeysPage
  const mutations = useApiTokenMutation()
  const enabled = apiKey.enabled !== false

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{apiKey.name || messages.list.untitled}</h3>
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? messages.list.enabled : messages.list.disabled}
            </Badge>
            {apiKey.start && <Badge variant="outline">{apiKey.start}</Badge>}
          </div>
          <div className="flex flex-wrap gap-1">
            {apiKey.permissionList.length ? (
              apiKey.permissionList.map((permission) => (
                <Badge key={permission} variant="outline" className="font-mono text-[11px]">
                  {permissionLabel(permission, messages.permissions.fullAccess)}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{messages.list.noPermissions}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage(messages.list.metadata, {
              created: formatDate(apiKey.createdAt, messages.date.never),
              expires: formatDate(apiKey.expiresAt, messages.date.never),
              lastUsed: formatDate(apiKey.lastRequest, messages.date.never),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutations.update.isPending}
            onClick={() =>
              void mutations.update.mutateAsync({ keyId: apiKey.id, enabled: !enabled })
            }
          >
            {enabled ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
            {enabled ? messages.list.disable : messages.list.enable}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={mutations.remove.isPending}
            onClick={() => void mutations.remove.mutateAsync({ keyId: apiKey.id })}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {messages.list.delete}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
