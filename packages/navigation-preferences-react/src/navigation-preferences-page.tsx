"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createOperatorAdminNavigation,
  resolveOperatorAdminNavigation,
} from "@voyant-travel/admin/navigation/operator-navigation"
import { useAdminNavigationPreferencesMemberKey } from "@voyant-travel/admin/navigation/preferences"
import { useAdminExtensions } from "@voyant-travel/admin/providers/admin-extensions"
import { useOperatorAdminMessages } from "@voyant-travel/admin/providers/operator-admin-messages"
import type { NavItem } from "@voyant-travel/admin/types"
import type { NavigationVisibilityMap } from "@voyant-travel/navigation-preferences/contracts"
import { useVoyantReactContext } from "@voyant-travel/react"
import {
  Button,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import type * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  loadNavigationPreferences,
  navigationPreferencesQueryKey,
  navigationPreferencesQueryRoot,
} from "./client.js"
import { useNavigationPreferencesMessages } from "./i18n/provider.js"

type PreferenceMode = "inherit" | "show" | "hide"

export function NavigationPreferencesPage() {
  const client = useVoyantReactContext()
  const memberKey = useAdminNavigationPreferencesMemberKey()
  const queryClient = useQueryClient()
  const messages = useNavigationPreferencesMessages()
  const adminMessages = useOperatorAdminMessages()
  const extensions = useAdminExtensions()
  const navigation = useMemo(
    () =>
      resolveOperatorAdminNavigation({
        baseItems: createOperatorAdminNavigation({ messages: adminMessages.nav }),
        extensions,
      }),
    [adminMessages.nav, extensions],
  )
  const rows = useMemo(() => flattenNavigation(navigation), [navigation])
  const query = useQuery({
    queryKey: navigationPreferencesQueryKey(memberKey),
    queryFn: () => loadNavigationPreferences(client),
  })
  const [organization, setOrganization] = useState<NavigationVisibilityMap>({})
  const [member, setMember] = useState<NavigationVisibilityMap>({})

  useEffect(() => {
    if (!query.data) return
    setOrganization(query.data.organization)
    setMember(query.data.member)
  }, [query.data])

  const save = useMutation({
    mutationFn: async ({
      scope,
      visibility,
    }: {
      scope: "organization" | "me"
      visibility: NavigationVisibilityMap
    }) => {
      const response = await client.fetcher(
        `${client.baseUrl}/v1/admin/navigation-preferences/${scope}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visibility }),
        },
      )
      if (!response.ok) throw new Error(`${messages.saveFailed} (${response.status})`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: navigationPreferencesQueryRoot })
      toast.success(messages.saved)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : messages.saveFailed)
    },
  })

  if (query.isPending) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">{messages.loading}</span>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive" role="alert">
          {messages.loadFailed}
        </p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          {messages.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{messages.title}</h1>
      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">{messages.personal}</TabsTrigger>
          {query.data?.canManageOrganization ? (
            <TabsTrigger value="organization">{messages.organization}</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="personal" className="mt-4">
          <PreferenceList
            rows={rows}
            renderControl={(item) => (
              <ToggleGroup
                value={[memberMode(member, item.id)]}
                onValueChange={(value: string[]) => {
                  const mode = value[0] as PreferenceMode | undefined
                  if (mode) setMember(setMemberMode(member, item.id, mode))
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="inherit">{messages.inherit}</ToggleGroupItem>
                <ToggleGroupItem value="show">{messages.show}</ToggleGroupItem>
                <ToggleGroupItem value="hide">{messages.hide}</ToggleGroupItem>
              </ToggleGroup>
            )}
          />
          <PreferenceActions
            resetLabel={messages.reset}
            saveLabel={messages.save}
            saving={save.isPending}
            onReset={() => setMember({})}
            onSave={() => save.mutate({ scope: "me", visibility: member })}
          />
        </TabsContent>
        {query.data?.canManageOrganization ? (
          <TabsContent value="organization" className="mt-4">
            <PreferenceList
              rows={rows}
              renderControl={(item) => (
                <Switch
                  aria-label={item.title}
                  checked={organization[item.id] !== false}
                  onCheckedChange={(checked: boolean) =>
                    setOrganization({ ...organization, [item.id]: checked })
                  }
                />
              )}
            />
            <PreferenceActions
              resetLabel={messages.reset}
              saveLabel={messages.save}
              saving={save.isPending}
              onReset={() => setOrganization({})}
              onSave={() => save.mutate({ scope: "organization", visibility: organization })}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

function PreferenceList({
  rows,
  renderControl,
}: {
  rows: ReadonlyArray<{ item: NavItem | NonNullable<NavItem["items"]>[number]; depth: number }>
  renderControl: (item: NavItem | NonNullable<NavItem["items"]>[number]) => React.ReactNode
}) {
  return (
    <div className="divide-y border-y">
      {rows.map(({ item, depth }) => (
        <div key={item.id} className="flex min-h-14 items-center justify-between gap-4 py-2">
          <div className={depth ? "min-w-0 pl-6" : "min-w-0"}>
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-xs text-muted-foreground">{item.url}</div>
          </div>
          <div className="shrink-0">{renderControl(item)}</div>
        </div>
      ))}
    </div>
  )
}

function PreferenceActions({
  resetLabel,
  saveLabel,
  saving,
  onReset,
  onSave,
}: {
  resetLabel: string
  saveLabel: string
  saving: boolean
  onReset: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onReset} disabled={saving}>
        {resetLabel}
      </Button>
      <Button type="button" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  )
}

function flattenNavigation(items: ReadonlyArray<NavItem>) {
  return items.flatMap((item) => [
    { item, depth: 0 },
    ...(item.items?.map((child) => ({ item: child, depth: 1 })) ?? []),
  ])
}

function memberMode(visibility: NavigationVisibilityMap, id: string): PreferenceMode {
  if (!Object.hasOwn(visibility, id)) return "inherit"
  return visibility[id] === false ? "hide" : "show"
}

function setMemberMode(
  visibility: NavigationVisibilityMap,
  id: string,
  mode: PreferenceMode,
): NavigationVisibilityMap {
  const next = { ...visibility }
  if (mode === "inherit") delete next[id]
  else next[id] = mode === "show"
  return next
}
