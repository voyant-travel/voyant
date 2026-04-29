"use client"

import { useLocale } from "@voyantjs/admin"
import {
  type BookingTravelerRecord,
  useBookingTravelerDocumentMutation,
  useBookingTravelerDocuments,
  useTravelers,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingDocumentDialog } from "./booking-document-dialog"

const typeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  visa: "default",
  insurance: "secondary",
  health: "secondary",
  passport_copy: "outline",
  other: "outline",
}

function getDocumentTypeLabel(
  type: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["documents"],
) {
  switch (type) {
    case "visa":
      return messages.typeVisa
    case "insurance":
      return messages.typeInsurance
    case "health":
      return messages.typeHealth
    case "passport_copy":
      return messages.typePassportCopy
    case "other":
      return messages.typeOther
    default:
      return type.replace(/_/g, " ")
  }
}

export interface BookingDocumentListProps {
  bookingId: string
}

export function BookingDocumentList({ bookingId }: BookingDocumentListProps) {
  const detailMessages = useAdminMessages().bookings.detail
  const documentMessages = detailMessages.documents
  const { resolvedLocale } = useLocale()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { data } = useBookingTravelerDocuments(bookingId)
  const { data: travelersData } = useTravelers(bookingId)
  const { remove } = useBookingTravelerDocumentMutation(bookingId)

  const documents = data?.data ?? []
  const travelers = travelersData?.data ?? []

  const travelerMap = new Map<string, BookingTravelerRecord>()
  for (const traveler of travelers) {
    travelerMap.set(traveler.id, traveler)
  }

  return (
    <Card data-slot="booking-document-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {documentMessages.title}
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {documentMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{documentMessages.empty}</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{documentMessages.tableType}</th>
                  <th className="p-2 text-left font-medium">{documentMessages.tableFile}</th>
                  <th className="p-2 text-left font-medium">{documentMessages.tableTraveler}</th>
                  <th className="p-2 text-left font-medium">{documentMessages.tableExpires}</th>
                  <th className="p-2 text-left font-medium">{documentMessages.tableNotes}</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const traveler = doc.travelerId ? travelerMap.get(doc.travelerId) : undefined
                  return (
                    <tr key={doc.id} className="border-b last:border-b-0">
                      <td className="p-2">
                        <Badge variant={typeVariant[doc.type] ?? "outline"}>
                          {getDocumentTypeLabel(doc.type, documentMessages)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {doc.fileName}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </td>
                      <td className="p-2">
                        {traveler
                          ? `${traveler.firstName} ${traveler.lastName}`
                          : doc.travelerId
                            ? doc.travelerId
                            : detailMessages.noValue}
                      </td>
                      <td className="p-2">
                        {doc.expiresAt
                          ? new Date(doc.expiresAt).toLocaleDateString(resolvedLocale)
                          : detailMessages.noValue}
                      </td>
                      <td className="max-w-[200px] truncate p-2 text-muted-foreground">
                        {doc.notes ?? detailMessages.noValue}
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(documentMessages.deleteConfirm)) {
                              remove.mutate(doc.id)
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <BookingDocumentDialog open={dialogOpen} onOpenChange={setDialogOpen} bookingId={bookingId} />
    </Card>
  )
}
