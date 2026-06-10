"use client"

import { Separator } from "@voyantjs/ui/components"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Label } from "@voyantjs/ui/components/label"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../../i18n/index.js"
import { setAccommodation } from "../../lib/draft-state.js"
import type { StepCommonProps } from "./shared.js"

// ─────────────────────────────────────────────────────────────────
// Accommodation
// ─────────────────────────────────────────────────────────────────

export function AccommodationStep({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const subSteps = shape.accommodation?.subSteps ?? []
  const rooms = shape.accommodation?.roomOptions ?? []
  const accommodation = draft.accommodation ?? {
    rooms: [],
    travelerAssignments: {},
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.accommodation.title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4">
        {rooms.length === 0 && subSteps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {messages.bookingJourney.accommodation.empty}
          </p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => {
              const current = accommodation.rooms.find((r) => r.optionUnitId === room.id)
              const ratePlans = room.ratePlans ?? []
              return (
                <div key={room.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{room.name}</div>
                      {room.description ? (
                        <div className="text-muted-foreground text-xs">{room.description}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const list = accommodation.rooms.filter((r) => r.optionUnitId !== room.id)
                          const qty = (current?.quantity ?? 0) - 1
                          if (qty > 0) {
                            list.push({
                              optionUnitId: room.id,
                              quantity: qty,
                              ratePlanId: current?.ratePlanId,
                            })
                          }
                          setDraft(
                            setAccommodation(draft, {
                              ...accommodation,
                              rooms: list,
                            }),
                          )
                        }}
                      >
                        −
                      </Button>
                      <span className="min-w-6 text-center">{current?.quantity ?? 0}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const list = accommodation.rooms.filter((r) => r.optionUnitId !== room.id)
                          const qty = (current?.quantity ?? 0) + 1
                          // Auto-select the only rate plan when there's
                          // exactly one — saves a click on the common case.
                          const ratePlanId =
                            current?.ratePlanId ??
                            (ratePlans.length === 1 ? ratePlans[0]?.id : undefined)
                          list.push({
                            optionUnitId: room.id,
                            quantity: qty,
                            ratePlanId,
                          })
                          setDraft(
                            setAccommodation(draft, {
                              ...accommodation,
                              rooms: list,
                            }),
                          )
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  {current && current.quantity > 0 && ratePlans.length > 0 ? (
                    <RatePlanPicker
                      roomId={room.id}
                      ratePlans={ratePlans}
                      selected={current.ratePlanId}
                      onSelect={(planId) => {
                        const list = accommodation.rooms.map((r) =>
                          r.optionUnitId === room.id ? { ...r, ratePlanId: planId } : r,
                        )
                        setDraft(
                          setAccommodation(draft, {
                            ...accommodation,
                            rooms: list,
                          }),
                        )
                      }}
                    />
                  ) : null}
                </div>
              )
            })}
            {subSteps.map((sub) =>
              sub.kind === "extensions" ? (
                <div
                  key="extensions"
                  className="rounded-md border p-3 text-muted-foreground text-sm"
                >
                  {formatMessage(messages.bookingJourney.accommodation.extensionsAvailable, {
                    count: sub.options.length,
                    plural: sub.options.length === 1 ? "" : "s",
                  })}
                </div>
              ) : null,
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RatePlanPicker({
  roomId,
  ratePlans,
  selected,
  onSelect,
}: {
  roomId: string
  ratePlans: ReadonlyArray<{
    id: string
    name: string
    description?: string | null
    chargeFrequency?: "per_night" | "per_stay"
    cancellationPolicy?: string | null
    inclusions?: ReadonlyArray<string>
  }>
  selected?: string
  onSelect: (id: string) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={`bj-rate-plan-${roomId}`}>
        {messages.bookingJourney.accommodation.ratePlan}
      </Label>
      <div className="space-y-2">
        {ratePlans.map((plan) => {
          const isSelected = plan.id === selected
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`w-full rounded-md border p-2 text-left text-sm ${
                isSelected ? "border-primary ring-2 ring-primary" : ""
              }`}
            >
              <div className="font-medium">{plan.name}</div>
              {plan.description ? (
                <div className="text-muted-foreground text-xs">{plan.description}</div>
              ) : null}
              {plan.cancellationPolicy ? (
                <div className="text-muted-foreground text-xs">
                  {messages.bookingJourney.accommodation.cancellationPrefix}{" "}
                  {plan.cancellationPolicy}
                </div>
              ) : null}
              {plan.inclusions && plan.inclusions.length > 0 ? (
                <div className="text-muted-foreground text-xs">
                  {messages.bookingJourney.accommodation.includesPrefix}{" "}
                  {plan.inclusions.join(", ")}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
