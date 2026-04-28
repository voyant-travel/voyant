"use client"

import {
  type BookingTravelerRecord,
  useTravelerMutation,
  useTravelers,
} from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Pencil, Plus, Trash2, Users } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { TravelerDialog } from "./traveler-dialog"

export interface TravelerListProps {
  bookingId: string
}

export function TravelerList({ bookingId }: TravelerListProps) {
  const detailMessages = useAdminMessages().bookings.detail
  const travelerMessages = detailMessages.travelers
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingTravelerRecord | undefined>(undefined)
  const { data } = useTravelers(bookingId)
  const { remove } = useTravelerMutation(bookingId)

  const travelers = data?.data ?? []

  return (
    <Card data-slot="traveler-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {travelerMessages.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {travelerMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {travelers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{travelerMessages.empty}</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{travelerMessages.tableName}</th>
                  <th className="p-2 text-left font-medium">{travelerMessages.tableEmail}</th>
                  <th className="p-2 text-left font-medium">{travelerMessages.tablePhone}</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {travelers.map((traveler) => (
                  <tr key={traveler.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {traveler.firstName} {traveler.lastName}
                    </td>
                    <td className="p-2">{traveler.email ?? detailMessages.noValue}</td>
                    <td className="p-2">{traveler.phone ?? detailMessages.noValue}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(traveler)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(travelerMessages.deleteConfirm)) {
                              remove.mutate(traveler.id)
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <TravelerDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        traveler={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}
