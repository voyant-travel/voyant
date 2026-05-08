import {
  addDays,
  areIntervalsOverlapping,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns"
import { cn } from "../../../lib/utils.js"
import { ScrollArea } from "../../scroll-area.js"

import { useCalendar } from "../context.js"
import { getEventBlockStyle, getVisibleHours, groupEvents, isWorkingHour } from "../helpers.js"
import type { IEvent } from "../interfaces.js"
import { CalendarTimeline } from "./calendar-time-line.js"
import { EventBlock } from "./event-block.js"
import { WeekViewMultiDayEventsRow } from "./week-view-multi-day-events-row.js"

interface IProps {
  singleDayEvents: IEvent[]
  multiDayEvents: IEvent[]
}

export function CalendarWeekView({ singleDayEvents, multiDayEvents }: IProps) {
  const { selectedDate, workingHours, visibleHours, onAddEvent } = useCalendar()

  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(
    visibleHours,
    singleDayEvents,
  )

  const weekStart = startOfWeek(selectedDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <>
      <div className="flex flex-col items-center justify-center border-b py-4 text-sm text-muted-foreground sm:hidden">
        <p>Weekly view is not available on smaller devices.</p>
        <p>Please switch to daily or monthly view.</p>
      </div>

      <div className="hidden flex-col sm:flex">
        <div>
          <WeekViewMultiDayEventsRow selectedDate={selectedDate} multiDayEvents={multiDayEvents} />

          <div className="relative z-20 flex border-b">
            <div className="w-18" />
            <div className="grid flex-1 grid-cols-7 divide-x border-l">
              {weekDays.map((day) => (
                <span
                  key={day.toISOString()}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {format(day, "EE")}{" "}
                  <span className="ml-1 font-semibold text-foreground">{format(day, "d")}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <ScrollArea className="h-[736px]">
          <div className="flex overflow-hidden">
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
              <div className="grid grid-cols-7 divide-x">
                {weekDays.map((day) => {
                  const dayEvents = singleDayEvents.filter(
                    (event) =>
                      isSameDay(parseISO(event.startDate), day) ||
                      isSameDay(parseISO(event.endDate), day),
                  )
                  const groupedEvents = groupEvents(dayEvents)

                  return (
                    <div key={day.toISOString()} className="relative">
                      {hours.map((hour, index) => {
                        const isDisabled = !isWorkingHour(day, hour, workingHours)

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
                                onClick={() => onAddEvent?.({ date: day, hour, minute })}
                                disabled={!onAddEvent}
                                className="absolute inset-x-0 h-[24px] cursor-pointer transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
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
                            day,
                            groupIndex,
                            groupedEvents.length,
                            {
                              from: earliestEventHour,
                              to: latestEventHour,
                            },
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
                  )
                })}
              </div>

              <CalendarTimeline
                firstVisibleHour={earliestEventHour}
                lastVisibleHour={latestEventHour}
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
