import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage, useLocale } from "@voyantjs/admin"
import { ProductDayDialog as DayDialog } from "@voyantjs/products-ui/components/product-day-dialog"
import { ProductVersionDialog as VersionDialog } from "@voyantjs/products-ui/components/product-version-dialog"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import {
  ArrowLeft,
  CalendarCheck,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { DayRow } from "./product-detail-day-row"
import {
  type DayService,
  formatAmount,
  formatMargin,
  getProductDaysQueryOptions,
  getProductNotesQueryOptions,
  getProductQueryOptions,
  getProductVersionsQueryOptions,
  type ProductDay,
  statusVariant,
} from "./product-detail-shared"
import { ProductDialog } from "./product-dialog"
import { ServiceDialog } from "./product-service-dialog"

export function ProductDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages().products
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [editingDay, setEditingDay] = useState<ProductDay | undefined>()
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [serviceDialogDayId, setServiceDialogDayId] = useState("")
  const [editingService, setEditingService] = useState<DayService | undefined>()
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)

  const { data: productData, isPending } = useQuery(getProductQueryOptions(id))
  const { data: daysData, refetch: refetchDays } = useQuery(getProductDaysQueryOptions(id))
  const { data: versionsData, refetch: refetchVersions } = useQuery(
    getProductVersionsQueryOptions(id),
  )
  const { data: notesData, refetch: refetchNotes } = useQuery(getProductNotesQueryOptions(id))
  const statusLabels: Record<"draft" | "active" | "archived", string> = {
    draft: messages.statusDraft,
    active: messages.statusActive,
    archived: messages.statusArchived,
  }

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void navigate({ to: "/products" })
    },
  })
  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/v1/products/${id}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("")
      void refetchNotes()
    },
  })
  const deleteDayMutation = useMutation({
    mutationFn: (dayId: string) => api.delete(`/v1/products/${id}/days/${dayId}`),
    onSuccess: () => void refetchDays(),
  })
  const deleteServiceMutation = useMutation({
    mutationFn: ({ dayId, serviceId }: { dayId: string; serviceId: string }) =>
      api.delete(`/v1/products/${id}/days/${dayId}/services/${serviceId}`),
  })
  const convertToBookingMutation = useMutation({
    mutationFn: () => {
      const now = new Date()
      const bookingNumber = `BK-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9000) + 1000)}`
      return api.post<{ data: { id: string } }>("/v1/bookings/from-product", {
        productId: id,
        bookingNumber,
      })
    },
    onSuccess: (result) => {
      void navigate({ to: "/bookings/$id", params: { id: result.data.id } })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const product = productData?.data
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{messages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/products" })}>
          {messages.backToProducts}
        </Button>
      </div>
    )
  }
  const nextDayNumber = (daysData?.data.length ?? 0) + 1

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/products" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusVariant[product.status] ?? "secondary"} className="capitalize">
              {statusLabels[product.status] ?? product.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(messages.convertToBookingConfirm)) convertToBookingMutation.mutate()
            }}
            disabled={convertToBookingMutation.isPending}
          >
            <CalendarCheck className="mr-2 h-4 w-4" />
            {messages.convertToBooking}
          </Button>
          <Button variant="outline" onClick={() => setVersionDialogOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            {messages.createVersionAction}
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {messages.editAction}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(messages.deleteConfirm)) deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {messages.deleteAction}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {product.description && (
              <div>
                <span className="text-muted-foreground">{messages.descriptionDetailLabel}:</span>{" "}
                <span>{product.description}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{messages.sellCurrencyLabel}:</span>{" "}
              <span>{product.sellCurrency}</span>
            </div>
            {product.sellAmountCents != null && (
              <div>
                <span className="text-muted-foreground">{messages.columnSellAmount}:</span>{" "}
                <span className="font-mono">
                  {formatAmount(product.sellAmountCents, product.sellCurrency)}
                </span>
              </div>
            )}
            {product.costAmountCents != null && (
              <div>
                <span className="text-muted-foreground">{messages.costAmountLabel}:</span>{" "}
                <span className="font-mono">
                  {formatAmount(product.costAmountCents, product.sellCurrency)}
                </span>
              </div>
            )}
            {product.marginPercent != null && (
              <div>
                <span className="text-muted-foreground">{messages.marginLabel}:</span>{" "}
                <span className="font-mono">{formatMargin(product.marginPercent)}</span>
              </div>
            )}
            {product.pax && (
              <div>
                <span className="text-muted-foreground">{messages.travelersLabel}:</span>{" "}
                <span>{product.pax}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{messages.tripDatesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.startDateLabel}:</span>{" "}
              <span>{product.startDate ?? messages.tbd}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.endDateLabel}:</span>{" "}
              <span>{product.endDate ?? messages.tbd}</span>
            </div>
            <div className="mt-2 border-t pt-3">
              <div>
                <span className="text-muted-foreground">{messages.createdLabel}:</span>{" "}
                <span>{new Date(product.createdAt).toLocaleDateString(resolvedLocale)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{messages.updatedLabel}:</span>{" "}
                <span>{new Date(product.updatedAt).toLocaleDateString(resolvedLocale)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{messages.itineraryTitle}</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingDay(undefined)
              setDayDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {messages.addDayAction}
          </Button>
        </CardHeader>
        <CardContent>
          {(!daysData?.data || daysData.data.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">{messages.noDays}</p>
          )}
          <div className="flex flex-col gap-2">
            {daysData?.data.map((day) => (
              <DayRow
                key={day.id}
                day={day}
                productId={id}
                expanded={expandedDayId === day.id}
                onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)}
                onEdit={() => {
                  setEditingDay(day)
                  setDayDialogOpen(true)
                }}
                onDelete={() => {
                  if (confirm(messages.dayDeleteConfirm)) deleteDayMutation.mutate(day.id)
                }}
                onAddService={() => {
                  setServiceDialogDayId(day.id)
                  setEditingService(undefined)
                  setServiceDialogOpen(true)
                }}
                onEditService={(service) => {
                  setServiceDialogDayId(day.id)
                  setEditingService(service)
                  setServiceDialogOpen(true)
                }}
                onDeleteService={(serviceId) => {
                  if (confirm(messages.serviceDeleteConfirm))
                    deleteServiceMutation.mutate(
                      { dayId: day.id, serviceId },
                      { onSuccess: () => void refetchDays() },
                    )
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.versionsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {(!versionsData?.data || versionsData.data.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">{messages.noVersions}</p>
          )}
          {versionsData?.data.map((version) => (
            <div key={version.id} className="mb-2 flex items-center gap-4 rounded-md border p-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm font-medium">
                  {formatMessage(messages.versionLabel, { version: String(version.versionNumber) })}
                </span>
                {version.notes && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{version.notes}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString(resolvedLocale)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.notesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={messages.addNotePlaceholder}
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              className="min-h-[80px]"
            />
            <Button
              className="self-end"
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate(noteContent.trim())}
            >
              {addNoteMutation.isPending ? messages.saving : messages.addNoteAction}
            </Button>
          </div>
          {notesData?.data.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{messages.noNotes}</p>
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

      <ProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries({ queryKey: ["product", id] })
          void queryClient.invalidateQueries({ queryKey: ["products"] })
        }}
      />
      <DayDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        productId={id}
        day={editingDay}
        nextDayNumber={nextDayNumber}
        onSuccess={() => {
          setDayDialogOpen(false)
          setEditingDay(undefined)
          void refetchDays()
        }}
      />
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        productId={id}
        dayId={serviceDialogDayId}
        service={editingService}
        onSuccess={() => {
          setServiceDialogOpen(false)
          setEditingService(undefined)
          void refetchDays()
        }}
      />
      <VersionDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        productId={id}
        onSuccess={() => {
          setVersionDialogOpen(false)
          void refetchVersions()
        }}
      />
    </div>
  )
}
