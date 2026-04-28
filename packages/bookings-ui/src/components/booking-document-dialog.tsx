"use client"

import { useBookingTravelerDocumentMutation, useTravelers } from "@voyantjs/bookings-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/voyant-ui/components"
import { DatePicker } from "@voyantjs/voyant-ui/components/date-picker"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { FileDropzone } from "./file-dropzone"

const documentTypes = ["visa", "insurance", "health", "passport_copy", "other"] as const

const UNASSIGNED = "__unassigned__"

const documentFormSchema = z.object({
  type: z.enum(documentTypes).default("other"),
  fileName: z.string().min(1, "File name is required").max(500),
  fileUrl: z.string().url("Must be a valid URL"),
  travelerId: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type DocumentFormValues = z.input<typeof documentFormSchema>
type DocumentFormOutput = z.output<typeof documentFormSchema>

export interface BookingDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onSuccess?: () => void
}

export function BookingDocumentDialog({
  open,
  onOpenChange,
  bookingId,
  onSuccess,
}: BookingDocumentDialogProps) {
  const { create } = useBookingTravelerDocumentMutation(bookingId)
  const { data: travelersData } = useTravelers(bookingId)
  const travelers = travelersData?.data ?? []

  const form = useForm<DocumentFormValues, unknown, DocumentFormOutput>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      type: "other",
      fileName: "",
      fileUrl: "",
      travelerId: UNASSIGNED,
      expiresAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [form, open])

  const onSubmit = async (values: DocumentFormOutput) => {
    await create.mutateAsync({
      type: values.type,
      fileName: values.fileName,
      fileUrl: values.fileUrl,
      travelerId: values.travelerId && values.travelerId !== UNASSIGNED ? values.travelerId : null,
      expiresAt: values.expiresAt || null,
      notes: values.notes || null,
    })

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  items={documentTypes.map((t) => ({ label: t.replace(/_/g, " "), value: t }))}
                  value={form.watch("type")}
                  onValueChange={(v) =>
                    form.setValue("type", (v ?? "other") as (typeof documentTypes)[number])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Traveler (optional)</Label>
                <Select
                  items={[
                    { label: "Booking-wide", value: UNASSIGNED },
                    ...travelers.map((traveler) => ({
                      label: `${traveler.firstName} ${traveler.lastName}`,
                      value: traveler.id,
                    })),
                  ]}
                  value={form.watch("travelerId") ?? UNASSIGNED}
                  onValueChange={(v) => form.setValue("travelerId", v ?? UNASSIGNED)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Booking-wide</SelectItem>
                    {travelers.map((traveler) => (
                      <SelectItem key={traveler.id} value={traveler.id}>
                        {traveler.firstName} {traveler.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>File</Label>
              <FileDropzone
                accept="application/pdf,image/*"
                maxSize={10 * 1024 * 1024}
                onUploaded={(upload) => {
                  form.setValue("fileUrl", upload.url, { shouldValidate: true })
                  form.setValue("fileName", upload.name, { shouldValidate: true })
                }}
                helperText="Drop passport, visa, or insurance document (PDF or image)"
              />
              {form.formState.errors.fileUrl && (
                <p className="text-xs text-destructive">{form.formState.errors.fileUrl.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Expires At (optional)</Label>
              <DatePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select expiry date"
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Additional notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
