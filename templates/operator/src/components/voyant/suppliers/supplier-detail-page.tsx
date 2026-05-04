import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import type { PaymentPolicy } from "@voyantjs/finance"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import {
  type SupplierCustomerPaymentPolicy,
  useSupplierMutation,
  useSupplierNoteMutation,
  useSupplierRateMutation,
  useSupplierServiceMutation,
} from "@voyantjs/suppliers-react"
import { SupplierServiceRow } from "@voyantjs/suppliers-ui/components/supplier-service-row"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAdminMessages } from "@/lib/admin-i18n"
import { RateDialog } from "./rate-dialog"
import { ServiceDialog } from "./service-dialog"
import {
  getSupplierNotesQueryOptions,
  getSupplierQueryOptions,
  getSupplierServicesQueryOptions,
  getSupplierStatusLabel,
  getSupplierTypeLabel,
  type SupplierRate,
  type SupplierService,
  statusVariant,
} from "./shared"
import { SupplierDetailSkeleton } from "./supplier-detail-skeleton"
import { SupplierDialog } from "./supplier-dialog"

export function SupplierDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.suppliers.details
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<SupplierService | undefined>()
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [rateDialogOpen, setRateDialogOpen] = useState(false)
  const [rateDialogServiceId, setRateDialogServiceId] = useState("")
  const [editingRate, setEditingRate] = useState<SupplierRate | undefined>()
  const supplierMutation = useSupplierMutation()
  const noteMutation = useSupplierNoteMutation(id)
  const serviceMutation = useSupplierServiceMutation(id)
  const rateMutation = useSupplierRateMutation(id)

  const { data: supplierData, isPending } = useQuery(getSupplierQueryOptions(id))
  const { data: servicesData } = useQuery(getSupplierServicesQueryOptions(id))
  const { data: notesData } = useQuery(getSupplierNotesQueryOptions(id))

  const persistedPolicy =
    (supplierData?.data?.customerPaymentPolicy as PaymentPolicy | null) ?? null
  const [policyDraft, setPolicyDraft] = useState<PaymentPolicy | null>(persistedPolicy)
  // One-way sync persisted → draft so a successful save (or a fresh
  // GET via query invalidation) refreshes the form. Re-fires only
  // when the persisted policy reference actually changes, so typing
  // mid-flight isn't clobbered by every render.
  useEffect(() => {
    setPolicyDraft(persistedPolicy)
  }, [persistedPolicy])

  if (isPending) {
    return <SupplierDetailSkeleton />
  }

  const supplier = supplierData?.data
  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/suppliers" })}>
          {detailMessages.backToSuppliers}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/suppliers" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{getSupplierTypeLabel(supplier.type, messages)}</Badge>
            <Badge variant={statusVariant[supplier.status] ?? "secondary"}>
              {getSupplierStatusLabel(supplier.status, messages)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {detailMessages.edit}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.deleteConfirm)) {
                supplierMutation.remove.mutate(id, {
                  onSuccess: () => void navigate({ to: "/suppliers" }),
                })
              }
            }}
            disabled={supplierMutation.remove.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {detailMessages.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.supplierDetailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {supplier.description && (
              <div>
                <span className="text-muted-foreground">{detailMessages.descriptionLabel}:</span>{" "}
                <span>{supplier.description}</span>
              </div>
            )}
            {supplier.email && (
              <div>
                <span className="text-muted-foreground">{detailMessages.emailLabel}:</span>{" "}
                <span>{supplier.email}</span>
              </div>
            )}
            {supplier.phone && (
              <div>
                <span className="text-muted-foreground">{detailMessages.phoneLabel}:</span>{" "}
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.website && (
              <div>
                <span className="text-muted-foreground">{detailMessages.websiteLabel}:</span>{" "}
                <span>{supplier.website}</span>
              </div>
            )}
            {supplier.address && (
              <div>
                <span className="text-muted-foreground">{detailMessages.addressLabel}:</span>{" "}
                <span>{supplier.address}</span>
              </div>
            )}
            {supplier.city && (
              <div>
                <span className="text-muted-foreground">{detailMessages.cityLabel}:</span>{" "}
                <span>{supplier.city}</span>
              </div>
            )}
            {supplier.country && (
              <div>
                <span className="text-muted-foreground">{detailMessages.countryLabel}:</span>{" "}
                <span>{supplier.country}</span>
              </div>
            )}
            {supplier.defaultCurrency && (
              <div>
                <span className="text-muted-foreground">
                  {detailMessages.defaultCurrencyLabel}:
                </span>{" "}
                <span>{supplier.defaultCurrency}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.primaryContactTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {supplier.contactName && (
              <div>
                <span className="text-muted-foreground">
                  {messages.suppliers.dialogs.supplier.contactNameLabel}:
                </span>{" "}
                <span>{supplier.contactName}</span>
              </div>
            )}
            {supplier.contactEmail && (
              <div>
                <span className="text-muted-foreground">
                  {messages.suppliers.dialogs.supplier.contactEmailLabel}:
                </span>{" "}
                <span>{supplier.contactEmail}</span>
              </div>
            )}
            {supplier.contactPhone && (
              <div>
                <span className="text-muted-foreground">
                  {messages.suppliers.dialogs.supplier.contactPhoneLabel}:
                </span>{" "}
                <span>{supplier.contactPhone}</span>
              </div>
            )}
            {!supplier.contactName && !supplier.contactEmail && !supplier.contactPhone && (
              <p className="text-muted-foreground">{detailMessages.noContactInfo}</p>
            )}
            <div className="mt-2 border-t pt-3">
              <div>
                <span className="text-muted-foreground">{detailMessages.createdLabel}:</span>{" "}
                <span>{new Date(supplier.createdAt).toLocaleDateString(resolvedLocale)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{detailMessages.updatedLabel}:</span>{" "}
                <span>{new Date(supplier.updatedAt).toLocaleDateString(resolvedLocale)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer payment policy</CardTitle>
          <CardDescription>
            When set, sourced bookings against this supplier inherit these terms instead of the
            operator default. Leave inheriting to fall back to the deployment-wide policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PaymentPolicyForm
            value={policyDraft}
            onChange={setPolicyDraft}
            inheritable={true}
            currency={supplier.defaultCurrency ?? "EUR"}
            disabled={supplierMutation.update.isPending}
          />
          <div className="flex flex-col gap-3">
            <PaymentPolicyPreview
              policy={policyDraft}
              currency={supplier.defaultCurrency ?? "EUR"}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={supplierMutation.update.isPending}
                onClick={() => {
                  supplierMutation.update.mutate(
                    {
                      id,
                      input: {
                        customerPaymentPolicy:
                          (policyDraft as SupplierCustomerPaymentPolicy | null) ?? null,
                      },
                    },
                    {
                      onSuccess: () => toast.success("Customer payment policy saved"),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to save policy"),
                    },
                  )
                }}
              >
                {supplierMutation.update.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save policy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{detailMessages.servicesTitle}</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingService(undefined)
              setServiceDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {detailMessages.addService}
          </Button>
        </CardHeader>
        <CardContent>
          {(!servicesData?.data || servicesData.data.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {detailMessages.noServices}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {servicesData?.data.map((service) => (
              <SupplierServiceRow
                key={service.id}
                service={service}
                supplierId={id}
                expanded={expandedServiceId === service.id}
                onToggle={() =>
                  setExpandedServiceId(expandedServiceId === service.id ? null : service.id)
                }
                onEdit={() => {
                  setEditingService(service)
                  setServiceDialogOpen(true)
                }}
                onDelete={() => {
                  if (confirm(detailMessages.serviceDeleteConfirm)) {
                    serviceMutation.remove.mutate(service.id)
                  }
                }}
                onAddRate={() => {
                  setRateDialogServiceId(service.id)
                  setEditingRate(undefined)
                  setRateDialogOpen(true)
                }}
                onEditRate={(rate) => {
                  setRateDialogServiceId(service.id)
                  setEditingRate(rate)
                  setRateDialogOpen(true)
                }}
                onDeleteRate={(rateId) => {
                  if (confirm(detailMessages.rateDeleteConfirm)) {
                    rateMutation.remove.mutate({ serviceId: service.id, rateId })
                  }
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.notesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={detailMessages.addNotePlaceholder}
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              className="min-h-[80px]"
            />
            <Button
              className="self-end"
              disabled={!noteContent.trim() || noteMutation.create.isPending}
              onClick={() =>
                noteMutation.create.mutate(
                  { content: noteContent.trim() },
                  { onSuccess: () => setNoteContent("") },
                )
              }
            >
              {noteMutation.create.isPending ? detailMessages.saving : detailMessages.add}
            </Button>
          </div>

          {notesData?.data.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {detailMessages.noNotes}
            </p>
          )}

          {notesData?.data.map((note) => (
            <div key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleString(resolvedLocale)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <SupplierDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        supplier={supplier}
        onSuccess={() => {
          setEditOpen(false)
        }}
      />

      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        supplierId={id}
        service={editingService}
        onSuccess={() => {
          setServiceDialogOpen(false)
          setEditingService(undefined)
        }}
      />

      <RateDialog
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        supplierId={id}
        serviceId={rateDialogServiceId}
        rate={editingRate}
        onSuccess={() => {
          setRateDialogOpen(false)
          setEditingRate(undefined)
        }}
      />
    </div>
  )
}
