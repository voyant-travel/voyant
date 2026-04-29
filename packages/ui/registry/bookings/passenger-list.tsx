"use client"

import {
  type BookingPassengerRecord,
  usePassengerMutation,
  usePassengers,
} from "@voyantjs/bookings-react"
import { Pencil, Plus, Trash2, Users } from "lucide-react"
import * as React from "react"

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

import { useRegistryBookingsMessagesOrDefault } from "./i18n"
import { PassengerDialog } from "./passenger-dialog"

export interface PassengerListProps {
  bookingId: string
}

export function PassengerList({ bookingId }: PassengerListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingPassengerRecord | undefined>(undefined)
  const { data } = usePassengers(bookingId)
  const { remove } = usePassengerMutation(bookingId)
  const messages = useRegistryBookingsMessagesOrDefault()

  const passengers = data?.data ?? []

  return (
    <Card data-slot="passenger-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {messages.passengerList.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.passengerList.addPassenger}
        </Button>
      </CardHeader>
      <CardContent>
        {passengers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.passengerList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.passengerList.columns.name}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.passengerList.columns.email}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.passengerList.columns.phone}
                  </th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {passengers.map((passenger) => (
                  <tr key={passenger.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {passenger.firstName} {passenger.lastName}
                    </td>
                    <td className="p-2">
                      {passenger.email ?? messages.passengerList.values.emailUnavailable}
                    </td>
                    <td className="p-2">
                      {passenger.phone ?? messages.passengerList.values.phoneUnavailable}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(passenger)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(messages.passengerList.actions.deleteConfirm)) {
                              remove.mutate(passenger.id)
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

      <PassengerDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        passenger={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}
