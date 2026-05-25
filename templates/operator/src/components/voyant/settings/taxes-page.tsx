"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { TaxesPage as FinanceTaxesPage } from "@voyantjs/finance-ui"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { toast } from "sonner"

import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"

interface BookingTaxSettings {
  taxPriceMode: "inclusive" | "exclusive"
  taxPolicyProfileId: string | null
}

interface TaxPolicyProfileRecord {
  id: string
  name: string
  jurisdiction?: string | null
}

export function TaxesPage() {
  return (
    <div className="flex flex-col gap-6">
      <BookingTaxSettingsCard />
      <FinanceTaxesPage />
    </div>
  )
}

function BookingTaxSettingsCard() {
  const queryClient = useQueryClient()
  const t = useAdminMessages().settings.bookingTaxSettings
  const settingsQuery = useQuery({
    queryKey: ["booking-tax-settings"],
    queryFn: async (): Promise<BookingTaxSettings> => {
      const res = await fetch(`${getApiUrl()}/v1/admin/bookings/tax-settings`, {
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error(`Failed to load booking tax settings (${res.status})`)
      }
      const json = (await res.json()) as { data: BookingTaxSettings }
      return json.data
    },
  })
  const taxPolicyProfilesQuery = useQuery({
    queryKey: ["tax-policy-profiles"],
    queryFn: async (): Promise<TaxPolicyProfileRecord[]> => {
      const res = await fetch(
        `${getApiUrl()}/v1/admin/finance/tax-policy-profiles?limit=100&active=true`,
        {
          credentials: "include",
        },
      )
      if (!res.ok) return []
      const json = (await res.json()) as { data?: TaxPolicyProfileRecord[] }
      return json.data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async (patch: Partial<BookingTaxSettings>) => {
      const res = await fetch(`${getApiUrl()}/v1/admin/bookings/tax-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      return (await res.json()) as { data: BookingTaxSettings }
    },
    onSuccess: () => {
      toast.success(t.savedToast)
      void queryClient.invalidateQueries({ queryKey: ["booking-tax-settings"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t.saveFailed)
    },
  })

  const settings = settingsQuery.data ?? {
    taxPriceMode: "inclusive",
    taxPolicyProfileId: null,
  }

  return (
    <Card className="mx-6 mt-6">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>{t.catalogPriceModeLabel}</Label>
          <Select
            value={settings.taxPriceMode}
            disabled={settingsQuery.isPending || save.isPending}
            onValueChange={(value) =>
              save.mutate({
                taxPriceMode: value === "exclusive" ? "exclusive" : "inclusive",
              })
            }
            items={[
              { value: "inclusive", label: t.priceModeInclusive },
              { value: "exclusive", label: t.priceModeExclusive },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inclusive">{t.priceModeInclusive}</SelectItem>
              <SelectItem value="exclusive">{t.priceModeExclusive}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t.taxPolicyProfileLabel}</Label>
          <Select
            value={settings.taxPolicyProfileId ?? "__auto__"}
            disabled={settingsQuery.isPending || save.isPending}
            onValueChange={(value) =>
              save.mutate({
                taxPolicyProfileId: value === "__auto__" ? null : value,
              })
            }
            items={[
              { value: "__auto__", label: t.taxPolicyAutomatic },
              ...(taxPolicyProfilesQuery.data ?? []).map((profile) => ({
                value: profile.id,
                label: profile.jurisdiction
                  ? `${profile.name} (${profile.jurisdiction})`
                  : profile.name,
              })),
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">{t.taxPolicyAutomatic}</SelectItem>
              {(taxPolicyProfilesQuery.data ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.jurisdiction
                    ? `${profile.name} (${profile.jurisdiction})`
                    : profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
