import { isToday, startOfDay } from "date-fns"
import * as React from "react"

import { cn } from "../../../lib/utils.js"

import { useCalendar } from "../context.js"
import { getMonthCellEvents } from "../helpers.js"
import type { ICalendarCell, IEvent } from "../interfaces.js"
import { EventBullet } from "./event-bullet.js"
import { MonthEventBadge } from "./month-event-badge.js"

interface IProps {
  cell: ICalendarCell
  events: IEvent[]
  eventPositions: Record<string, number>
  /** Optional override; defaults to selecting the date and switching to day view if onJumpToDay supplied. */
  onDayClick?: (date: Date) => void
}

const MAX_VISIBLE_EVENTS = 3

export function DayCell({ cell, events, eventPositions, onDayClick }: IProps) {
  const { setSelectedDate } = useCalendar()

  const { day, currentMonth, date } = cell

  const cellEvents = React.useMemo(
    () => getMonthCellEvents(date, events, eventPositions),
    [date, events, eventPositions],
  )
  const isSunday = date.getDay() === 0

  const handleClick = () => {
    setSelectedDate(date)
    onDayClick?.(date)
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1 border-l border-t py-1.5 lg:pb-2 lg:pt-1",
        isSunday && "border-l-0",
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex size-6 translate-x-1 items-center justify-center rounded-full text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:px-2",
          !currentMonth && "opacity-20",
          isToday(date) && "bg-primary font-bold text-primary-foreground hover:bg-primary",
        )}
      >
        {day}
      </button>

      <div
        className={cn(
          "flex h-6 gap-1 px-2 lg:h-[94px] lg:flex-col lg:gap-2 lg:px-0",
          !currentMonth && "opacity-50",
        )}
      >
        {[0, 1, 2].map((position) => {
          const event = cellEvents.find((e) => e.position === position)
          const eventKey = event ? `event-${event.id}-${position}` : `empty-${position}`

          return (
            <div key={eventKey} className="lg:flex-1">
              {event ? (
                <>
                  <EventBullet className="lg:hidden" color={event.color} />
                  <MonthEventBadge
                    className="hidden lg:flex"
                    event={event}
                    cellDate={startOfDay(date)}
                  />
                </>
              ) : null}
            </div>
          )
        })}
      </div>

      {cellEvents.length > MAX_VISIBLE_EVENTS ? (
        <p
          className={cn(
            "h-4.5 px-1.5 text-xs font-semibold text-muted-foreground",
            !currentMonth && "opacity-50",
          )}
        >
          <span className="sm:hidden">+{cellEvents.length - MAX_VISIBLE_EVENTS}</span>
          <span className="hidden sm:inline">
            {" "}
            {cellEvents.length - MAX_VISIBLE_EVENTS} more...
          </span>
        </p>
      ) : null}
    </div>
  )
}
