"use client"

/**
 * Settings -> Operator profile.
 *
 * Operator identity, payment instructions, and operator-level
 * booking payment defaults live in separate API/storage concepts, but
 * remain one operational settings form.
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
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { getApiUrl } from "@/lib/env"

interface OperatorProfileForm {
  name?: string | null
  legalName?: string | null
  vatId?: string | null
  registrationNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  bankTransferBeneficiary?: string | null
  iban?: string | null
  bank?: string | null
  notes?: string | null
  license?: string | null
  licenseAuthority?: string | null
  signatoryName?: string | null
  signatoryRole?: string | null
  customerPaymentPolicy?: PaymentPolicy | null
}

type OperatorProfileRecord = Omit<
  OperatorProfileForm,
  "bankTransferBeneficiary" | "iban" | "bank" | "notes" | "customerPaymentPolicy"
>
type OperatorPaymentInstructionsRecord = Pick<
  OperatorProfileForm,
  "bankTransferBeneficiary" | "iban" | "bank" | "notes"
>
type OperatorPaymentDefaultsRecord = Pick<OperatorProfileForm, "customerPaymentPolicy">

const EMPTY_FORM: OperatorProfileForm = {
  name: "",
  legalName: "",
  vatId: "",
  registrationNumber: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  bankTransferBeneficiary: "",
  iban: "",
  bank: "",
  notes: "",
  license: "",
  licenseAuthority: "",
  signatoryName: "",
  signatoryRole: "",
  customerPaymentPolicy: null,
}

export function OperatorProfilePage() {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ["operator-profile-settings"],
    queryFn: async (): Promise<OperatorProfileForm | null> => {
      const [profileRes, instructionsRes, defaultsRes] = await Promise.all([
        fetch(`${getApiUrl()}/v1/admin/settings/operator-profile`, { credentials: "include" }),
        fetch(`${getApiUrl()}/v1/admin/settings/operator-payment-instructions`, {
          credentials: "include",
        }),
        fetch(`${getApiUrl()}/v1/admin/settings/operator-payment-defaults`, {
          credentials: "include",
        }),
      ])
      if (!profileRes.ok && !instructionsRes.ok && !defaultsRes.ok) return null

      const [profileJson, instructionsJson, defaultsJson] = await Promise.all([
        profileRes.ok
          ? ((await profileRes.json()) as { data?: OperatorProfileRecord | null })
          : { data: null },
        instructionsRes.ok
          ? ((await instructionsRes.json()) as { data?: OperatorPaymentInstructionsRecord | null })
          : { data: null },
        defaultsRes.ok
          ? ((await defaultsRes.json()) as { data?: OperatorPaymentDefaultsRecord | null })
          : { data: null },
      ])

      return {
        ...EMPTY_FORM,
        ...(profileJson.data ?? {}),
        ...(instructionsJson.data ?? {}),
        customerPaymentPolicy: defaultsJson.data?.customerPaymentPolicy ?? null,
      }
    },
  })
  const [form, setForm] = useState<OperatorProfileForm>(EMPTY_FORM)

  useEffect(() => {
    if (data) {
      setForm({ ...EMPTY_FORM, ...data })
    }
  }, [data])

  const save = useMutation({
    mutationFn: async (next: OperatorProfileForm) => {
      const responses = await Promise.all([
        fetch(`${getApiUrl()}/v1/admin/settings/operator-profile`, {
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
            license: next.license ?? null,
            licenseAuthority: next.licenseAuthority ?? null,
            signatoryName: next.signatoryName ?? null,
            signatoryRole: next.signatoryRole ?? null,
          }),
        }),
        fetch(`${getApiUrl()}/v1/admin/settings/operator-payment-instructions`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bankTransferBeneficiary: next.bankTransferBeneficiary ?? null,
            iban: next.iban ?? null,
            bank: next.bank ?? null,
            notes: next.notes ?? null,
          }),
        }),
        fetch(`${getApiUrl()}/v1/admin/settings/operator-payment-defaults`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerPaymentPolicy: next.customerPaymentPolicy ?? null,
          }),
        }),
      ])
      const failed = responses.find((res) => !res.ok)
      if (failed) {
        const body = (await failed.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${failed.status})`)
      }
    },
    onSuccess: () => {
      toast.success("Operator profile saved")
      void queryClient.invalidateQueries({ queryKey: ["operator-profile-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["public-operator-profile"] })
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

  const setField = <K extends keyof OperatorProfileForm>(key: K, value: OperatorProfileForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form
      className="mx-auto flex max-w-4xl flex-col gap-6 p-6"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(form)
      }}
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operator profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator identity for contracts, public legal blocks, and payment collection. These
          details populate <code>operator.*</code> in contract templates.
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
          <CardTitle>Payment collection</CardTitle>
          <CardDescription>For bank-transfer payment instructions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="op-bankTransferBeneficiary">Bank-transfer beneficiary</Label>
            <Input
              id="op-bankTransferBeneficiary"
              value={form.bankTransferBeneficiary ?? ""}
              placeholder="Defaults to legal name"
              onChange={(e) => setField("bankTransferBeneficiary", e.target.value)}
            />
          </div>
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
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="op-notes">Payment notes</Label>
            <Textarea
              id="op-notes"
              value={form.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>License</CardTitle>
          <CardDescription>
            Tour license, hotel rating registry, cruise flag-state, or whichever applies.
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}

export const OperatorSettingsPage = OperatorProfilePage
