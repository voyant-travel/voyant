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
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

import { FileDropzone } from "./file-dropzone"

const documentTypes = ["visa", "insurance", "health", "passport_copy", "other"] as const

const UNASSIGNED = "__unassigned__"

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
  const documentMessages = useAdminMessages().bookings.detail.documentDialog
  const { create } = useBookingTravelerDocumentMutation(bookingId)
  const { data: travelersData } = useTravelers(bookingId)
  const travelers = travelersData?.data ?? []

  const documentFormSchema = z.object({
    type: z.enum(documentTypes).default("other"),
    fileName: z.string().min(1, documentMessages.validationFileNameRequired).max(500),
    fileUrl: z.string().url(documentMessages.validationFileUrlInvalid),
    travelerId: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })

  type DocumentFormValues = z.input<typeof documentFormSchema>
  type DocumentFormOutput = z.output<typeof documentFormSchema>

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
          <DialogTitle>{documentMessages.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{documentMessages.typeLabel}</Label>
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
                        {t === "visa"
                          ? documentMessages.typeVisa
                          : t === "insurance"
                            ? documentMessages.typeInsurance
                            : t === "health"
                              ? documentMessages.typeHealth
                              : t === "passport_copy"
                                ? documentMessages.typePassportCopy
                                : documentMessages.typeOther}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{documentMessages.travelerLabel}</Label>
                <Select
                  items={[
                    { label: documentMessages.bookingWide, value: UNASSIGNED },
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
                    <SelectItem value={UNASSIGNED}>{documentMessages.bookingWide}</SelectItem>
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
              <Label>{documentMessages.fileLabel}</Label>
              <FileDropzone
                accept="application/pdf,image/*"
                maxSize={10 * 1024 * 1024}
                onUploaded={(upload) => {
                  form.setValue("fileUrl", upload.url, { shouldValidate: true })
                  form.setValue("fileName", upload.name, { shouldValidate: true })
                }}
                helperText={documentMessages.fileHelperText}
                idleText={documentMessages.uploadIdle}
                acceptedPrefix={documentMessages.uploadAcceptedPrefix}
                uploadingText={documentMessages.uploadUploading}
                removeFileAriaLabel={documentMessages.uploadRemoveAriaLabel}
                uploadFailedMessage={documentMessages.uploadFailed}
                fileTooLargeMessage={documentMessages.uploadFileTooLarge}
              />
              {form.formState.errors.fileUrl && (
                <p className="text-xs text-destructive">{form.formState.errors.fileUrl.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{documentMessages.expiresAtLabel}</Label>
              <DatePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={documentMessages.expiresAtPlaceholder}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{documentMessages.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={documentMessages.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {documentMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {documentMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
