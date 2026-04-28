import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Label, Textarea } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

import { getProductDayMediaQueryOptions } from "./product-detail-shared"
import { ProductMediaGallery } from "./product-media-gallery"

type DayMessages = ReturnType<typeof useAdminMessages>["products"]["operations"]["days"]

const buildDayFormSchema = (messages: DayMessages) =>
  z.object({
    dayNumber: z.coerce.number().int().positive(messages.validationDayNumber),
    title: z.string().max(255).optional().nullable(),
    description: z.string().optional().nullable(),
    location: z.string().max(255).optional().nullable(),
  })

type DayFormSchema = ReturnType<typeof buildDayFormSchema>
type DayFormValues = z.input<DayFormSchema>
type DayFormOutput = z.output<DayFormSchema>

export type DayData = {
  id: string
  dayNumber: number
  title: string | null
  description: string | null
  location: string | null
}

export interface DayFormProps {
  productId: string
  itineraryId: string
  day?: DayData
  nextDayNumber?: number
  onSuccess: () => void
  onCancel?: () => void
}

export function DayForm({
  productId,
  itineraryId,
  day,
  nextDayNumber,
  onSuccess,
  onCancel,
}: DayFormProps) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const dayMessages = messages.products.operations.days
  const isEditing = !!day
  const dayFormSchema = buildDayFormSchema(dayMessages)

  const form = useForm<DayFormValues, unknown, DayFormOutput>({
    resolver: zodResolver(dayFormSchema),
    defaultValues: day
      ? {
          dayNumber: day.dayNumber,
          title: day.title ?? "",
          description: day.description ?? "",
          location: day.location ?? "",
        }
      : {
          dayNumber: nextDayNumber ?? 1,
          title: "",
          description: "",
          location: "",
        },
  })

  useEffect(() => {
    if (day) {
      form.reset({
        dayNumber: day.dayNumber,
        title: day.title ?? "",
        description: day.description ?? "",
        location: day.location ?? "",
      })
    } else {
      form.reset({
        dayNumber: nextDayNumber ?? 1,
        title: "",
        description: "",
        location: "",
      })
    }
  }, [day, nextDayNumber, form])

  const onSubmit = async (values: DayFormOutput) => {
    const payload = {
      dayNumber: values.dayNumber,
      title: values.title || null,
      description: values.description || null,
      location: values.location || null,
    }

    if (isEditing) {
      await api.patch(`/v1/products/${productId}/days/${day.id}`, payload)
    } else {
      await api.post(`/v1/products/${productId}/itineraries/${itineraryId}/days`, payload)
    }
    onSuccess()
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-6 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{dayMessages.dayNumberLabel}</Label>
            <Input {...form.register("dayNumber")} type="number" min="1" />
            {form.formState.errors.dayNumber && (
              <p className="text-xs text-destructive">{form.formState.errors.dayNumber.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{dayMessages.locationLabel}</Label>
            <Input {...form.register("location")} placeholder={dayMessages.locationPlaceholder} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{dayMessages.titleLabel}</Label>
          <Input {...form.register("title")} placeholder={dayMessages.titlePlaceholder} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{dayMessages.descriptionLabel}</Label>
          <Textarea
            {...form.register("description")}
            placeholder={dayMessages.descriptionPlaceholder}
            rows={4}
          />
        </div>
      </div>

      {isEditing && day ? (
        <DayMediaSection productId={productId} dayId={day.id} />
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          {dayMessages.saveToUpload}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? productMessages.saveChanges : dayMessages.create}
        </Button>
      </div>
    </form>
  )
}

function DayMediaSection({ productId, dayId }: { productId: string; dayId: string }) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const queryClient = useQueryClient()

  const { data } = useQuery(getProductDayMediaQueryOptions(productId, dayId))
  const media = data?.data ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["day-media", productId, dayId] })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/v1/uploads", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!uploadRes.ok) throw new Error(productMessages.uploadFailed)
      const upload = (await uploadRes.json()) as {
        key: string
        url: string
        mimeType: string
        size: number
      }

      const mediaType = upload.mimeType.startsWith("video/")
        ? "video"
        : upload.mimeType.startsWith("image/")
          ? "image"
          : "document"

      return api.post(`/v1/products/${productId}/days/${dayId}/media`, {
        mediaType,
        name: file.name,
        url: upload.url,
        storageKey: upload.key,
        mimeType: upload.mimeType,
        fileSize: upload.size,
      })
    },
    onSuccess: () => void invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => api.delete(`/v1/products/media/${mediaId}`),
    onSuccess: () => void invalidate(),
  })

  const setCoverMutation = useMutation({
    mutationFn: (mediaId: string) => api.patch(`/v1/products/media/${mediaId}/set-cover`, {}),
    onSuccess: () => void invalidate(),
  })

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm">{messages.products.operations.days.photosLabel}</Label>
      <ProductMediaGallery
        productId={productId}
        media={media}
        isUploading={uploadMutation.isPending}
        onUpload={(file) => uploadMutation.mutate(file)}
        onSetCover={(id) => setCoverMutation.mutate(id)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  )
}
