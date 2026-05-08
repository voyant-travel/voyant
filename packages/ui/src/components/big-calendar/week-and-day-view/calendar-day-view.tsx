import { areIntervalsOverlapping, format, parseISO } from "date-fns"
import { Calendar as CalendarIcon, Clock, Plus, User } from "lucide-react"
import { cn } from "../../../lib/utils.js"
import { Button } from "../../button.js"
import { ScrollArea } from "../../scroll-area.js"

import { useCalendar } from "../context.js"
import {
  getCurrentEvents,
  getEventBlockStyle,
  getVisibleHours,
  groupEvents,
  isWorkingHour,
} from "../helpers.js"
import type { IEvent } from "../interfaces.js"
import { CalendarTimeline } from "./calendar-time-line.js"
import { DayViewMultiDayEventsRow } from "./day-view-multi-day-events-row.js"
import { EventBlock } from "./event-block.js"

interface IProps {
  singleDayEvents: IEvent[]
  multiDayEvents: IEvent[]
}

export function CalendarDayView({ singleDayEvents, multiDayEvents }: IProps) {
  const { selectedDate, users, visibleHours, workingHours, onAddEvent } = useCalendar()

  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(
    visibleHours,
    singleDayEvents,
  )

  const currentEvents = getCurrentEvents(singleDayEvents)

  const dayEvents = singleDayEvents.filter((event) => {
    const eventDate = parseISO(event.startDate)
    return (
      eventDate.getDate() === selectedDate.getDate() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getFullYear() === selectedDate.getFullYear()
    )
  })

  const groupedEvents = groupEvents(dayEvents)

  return (
    <div className="flex">
      <div className="flex flex-1 flex-col">
        <div>
          <DayViewMultiDayEventsRow selectedDate={selectedDate} multiDayEvents={multiDayEvents} />

          <div className="relative z-20 flex border-b">
            <div className="w-18" />
            <span className="flex-1 border-l py-2 text-center text-xs font-medium text-muted-foreground">
              {format(selectedDate, "EE")}{" "}
              <span className="font-semibold text-foreground">{format(selectedDate, "d")}</span>
            </span>
          </div>
        </div>

        <ScrollArea className="h-[800px]">
          <div className="flex">
            <div className="relative w-18">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: "96px" }}>
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    {index !== 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date().setHours(hour, 0, 0, 0), "hh a")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative flex-1 border-l">
              <div className="relative">
                {hours.map((hour, index) => {
                  const isDisabled = !isWorkingHour(selectedDate, hour, workingHours)

                  return (
                    <div
                      key={hour}
                      className={cn("relative", isDisabled && "bg-calendar-disabled-hour")}
                      style={{ height: "96px" }}
                    >
                      {index !== 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 top-0 border-b" />
                      ) : null}

                      {[0, 15, 30, 45].map((minute, slot) => (
                        <button
                          key={minute}
                          type="button"
                          onClick={() =>
                            onAddEvent?.({
                              date: selectedDate,
                              hour,
                              minute,
                            })
                          }
                          disabled={!onAddEvent}
                          className={cn(
                            "absolute inset-x-0 h-[24px] cursor-pointer transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent",
                          )}
                          style={{ top: slot * 24 }}
                          aria-label={`Add event at ${hour}:${String(minute).padStart(2, "0")}`}
                        />
                      ))}

                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed" />
                    </div>
                  )
                })}

                {groupedEvents.map((group, groupIndex) =>
                  group.map((event) => {
                    let style = getEventBlockStyle(
                      event,
                      selectedDate,
                      groupIndex,
                      groupedEvents.length,
                      { from: earliestEventHour, to: latestEventHour },
                    )
                    const hasOverlap = groupedEvents.some(
                      (otherGroup, otherIndex) =>
                        otherIndex !== groupIndex &&
                        otherGroup.some((otherEvent) =>
                          areIntervalsOverlapping(
                            {
                              start: parseISO(event.startDate),
                              end: parseISO(event.endDate),
                            },
                            {
                              start: parseISO(otherEvent.startDate),
                              end: parseISO(otherEvent.endDate),
                            },
                          ),
                        ),
                    )

                    if (!hasOverlap) style = { ...style, width: "100%", left: "0%" }

                    return (
                      <div key={event.id} className="absolute p-1" style={style}>
                        <EventBlock event={event} />
                      </div>
                    )
                  }),
                )}
              </div>

              <CalendarTimeline
                firstVisibleHour={earliestEventHour}
                lastVisibleHour={latestEventHour}
              />
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="hidden w-64 divide-y border-l md:block">
        <div className="p-4">
          {onAddEvent ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onAddEvent({ date: selectedDate })}
            >
              <Plus />
              Add event
            </Button>
          ) : null}
        </div>

        <div className="flex-1 space-y-3">
          {currentEvents.length > 0 ? (
            <div className="flex items-start gap-2 px-4 pt-4">
              <span className="relative mt-[5px] flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-green-600" />
              </span>

              <p className="text-sm font-semibold text-foreground">Happening now</p>
            </div>
          ) : (
            <p className="p-4 text-center text-sm italic text-muted-foreground">
              No events at the moment
            </p>
          )}

          {currentEvents.length > 0 ? (
            <ScrollArea className="h-[422px] px-4">
              <div className="space-y-6 pb-4">
                {currentEvents.map((event) => {
                  const eventUser = event.user
                    ? users.find((user) => user.id === event.user?.id)
                    : undefined

                  return (
                    <div key={event.id} className="space-y-1.5">
                      <p className="line-clamp-2 text-sm font-semibold">{event.title}</p>

                      {eventUser ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="size-3.5" />
                          <span className="text-sm">{eventUser.name}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="size-3.5" />
                        <span className="text-sm">{format(new Date(), "MMM d, yyyy")}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span className="text-sm">
                          {format(parseISO(event.startDate), "h:mm a")} -{" "}
                          {format(parseISO(event.endDate), "h:mm a")}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : null}
        </div>
      </div>
    </div>
  )
}
