"use client"

/**
 * Settings → Operator.
 *
 * Single-form page for the deployment's operator profile (the legal
 * entity that issues contracts to customers — tour agency, hotel,
 * cruise line, airline, DMC, …) plus the default customer payment
 * policy. The fields populate `operator.*` variables in contract
 * templates.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { noDepositPolicy, type PaymentPolicy } from "@voyantjs/finance"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { getApiUrl } from "@/lib/env"

interface OperatorSettingsRecord {
  id?: string
  name?: string | null
  legalName?: string | null
  vatId?: string | null
  registrationNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  iban?: string | null
  bank?: string | null
  license?: string | null
  licenseAuthority?: string | null
  signatoryName?: string | null
  signatoryRole?: string | null
  customerPaymentPolicy?: PaymentPolicy | null
  taxPriceMode?: "inclusive" | "exclusive"
  taxPolicyProfileId?: string | null
}

interface TaxPolicyProfileRecord {
  id: string
  name: string
  jurisdiction?: string | null
}

const EMPTY_FORM: OperatorSettingsRecord = {
  name: "",
  legalName: "",
  vatId: "",
  registrationNumber: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  iban: "",
  bank: "",
  license: "",
  licenseAuthority: "",
  signatoryName: "",
  signatoryRole: "",
  customerPaymentPolicy: null,
  taxPriceMode: "inclusive",
  taxPolicyProfileId: null,
}

export function OperatorSettingsPage() {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ["operator-settings"],
    queryFn: async (): Promise<OperatorSettingsRecord | null> => {
      const res = await fetch(`${getApiUrl()}/v1/admin/settings/operator`, {
        credentials: "include",
      })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: OperatorSettingsRecord | null }
      return json.data ?? null
    },
  })
  const taxPolicyProfilesQuery = useQuery({
    queryKey: ["tax-policy-profiles"],
    queryFn: async (): Promise<TaxPolicyProfileRecord[]> => {
      const res = await fetch(
        `${getApiUrl()}/v1/finance/tax-policy-profiles?limit=100&active=true`,
        {
          credentials: "include",
        },
      )
      if (!res.ok) return []
      const json = (await res.json()) as { data?: TaxPolicyProfileRecord[] }
      return json.data ?? []
    },
  })

  const [form, setForm] = useState<OperatorSettingsRecord>(EMPTY_FORM)

  useEffect(() => {
    if (data) {
      setForm({
        ...EMPTY_FORM,
        ...data,
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: async (next: OperatorSettingsRecord) => {
      const res = await fetch(`${getApiUrl()}/v1/admin/settings/operator`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: next.name ?? null,
          legalName: next.legalName ?? null,
          vatId: next.vatId ?? null,
          registrationNumber: next.registrationNumber ?? null,
          address: next.address ?? null,
          phone: next.phone ?? null,
          email: next.email ?? null,
          website: next.website ?? null,
          iban: next.iban ?? null,
          bank: next.bank ?? null,
          license: next.license ?? null,
          licenseAuthority: next.licenseAuthority ?? null,
          signatoryName: next.signatoryName ?? null,
          signatoryRole: next.signatoryRole ?? null,
          customerPaymentPolicy: next.customerPaymentPolicy ?? null,
          taxPriceMode: next.taxPriceMode ?? "inclusive",
          taxPolicyProfileId: next.taxPolicyProfileId ?? null,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      return (await res.json()) as { data: OperatorSettingsRecord | null }
    },
    onSuccess: () => {
      toast.success("Operator settings saved")
      void queryClient.invalidateQueries({ queryKey: ["operator-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["public-operator-settings"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed")
    },
  })

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const setField = <K extends keyof OperatorSettingsRecord>(
    key: K,
    value: OperatorSettingsRecord[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form
      className="mx-auto flex max-w-4xl flex-col gap-6 p-6"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(form)
      }}
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The legal entity that issues contracts to your customers — tour agency, hotel, cruise
          line, DMC, etc. These details populate <code>operator.*</code> in contract templates.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Trading name, legal name, and tax IDs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="op-name">Trading name</Label>
            <Input
              id="op-name"
              value={form.name ?? ""}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-legalName">Legal name</Label>
            <Input
              id="op-legalName"
              value={form.legalName ?? ""}
              onChange={(e) => setField("legalName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-vatId">VAT id</Label>
            <Input
              id="op-vatId"
              value={form.vatId ?? ""}
              onChange={(e) => setField("vatId", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-regNum">Trade-register number</Label>
            <Input
              id="op-regNum"
              value={form.registrationNumber ?? ""}
              onChange={(e) => setField("registrationNumber", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="op-address">Postal address</Label>
            <Textarea
              id="op-address"
              value={form.address ?? ""}
              onChange={(e) => setField("address", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-phone">Phone</Label>
            <Input
              id="op-phone"
              value={form.phone ?? ""}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-email">Email</Label>
            <Input
              id="op-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="op-website">Website</Label>
            <Input
              id="op-website"
              type="url"
              value={form.website ?? ""}
              onChange={(e) => setField("website", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking</CardTitle>
          <CardDescription>For bank-transfer payment instructions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="op-iban">IBAN</Label>
            <Input
              id="op-iban"
              value={form.iban ?? ""}
              onChange={(e) => setField("iban", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-bank">Bank name</Label>
            <Input
              id="op-bank"
              value={form.bank ?? ""}
              onChange={(e) => setField("bank", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>License</CardTitle>
          <CardDescription>
            Tour-operator license, hotel rating registry, cruise flag-state — whichever applies.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="op-license">License number</Label>
            <Input
              id="op-license"
              value={form.license ?? ""}
              onChange={(e) => setField("license", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-licenseAuthority">Issuing authority</Label>
            <Input
              id="op-licenseAuthority"
              value={form.licenseAuthority ?? ""}
              onChange={(e) => setField("licenseAuthority", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signatory</CardTitle>
          <CardDescription>
            The human whose name appears on the operator-side signature line of issued contracts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="op-signatoryName">Name</Label>
            <Input
              id="op-signatoryName"
              value={form.signatoryName ?? ""}
              onChange={(e) => setField("signatoryName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-signatoryRole">Role</Label>
            <Input
              id="op-signatoryRole"
              placeholder="Managing Director"
              value={form.signatoryRole ?? ""}
              onChange={(e) => setField("signatoryRole", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default customer payment policy</CardTitle>
          <CardDescription>
            Applied when no per-supplier, per-category, per-listing, or per-booking override exists.
            Defines the deposit / balance split shown on the storefront and persisted as the
            booking's payment schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PaymentPolicyForm
            value={form.customerPaymentPolicy ?? null}
            onChange={(next) => setField("customerPaymentPolicy", next)}
            inheritable={false}
          />
          <PaymentPolicyPreview policy={form.customerPaymentPolicy ?? noDepositPolicy} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax pricing</CardTitle>
          <CardDescription>
            Controls whether catalog prices entered in products and option pricing already include
            tax or have tax added on top at quote time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Catalog price mode</Label>
            <Select
              value={form.taxPriceMode ?? "inclusive"}
              onValueChange={(value) =>
                setField("taxPriceMode", value === "exclusive" ? "exclusive" : "inclusive")
              }
              items={[
                { value: "inclusive", label: "Tax inclusive" },
                { value: "exclusive", label: "Tax exclusive" },
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive">Tax inclusive</SelectItem>
                <SelectItem value="exclusive">Tax exclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tax policy profile</Label>
            <Select
              value={form.taxPolicyProfileId ?? "__auto__"}
              onValueChange={(value) =>
                setField("taxPolicyProfileId", value === "__auto__" ? null : value)
              }
              items={[
                { value: "__auto__", label: "Automatic active profile" },
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
                <SelectItem value="__auto__">Automatic active profile</SelectItem>
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}
