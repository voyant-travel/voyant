import * as React from "react"

import { useCalendar } from "../context.js"
import { calculateMonthEventPositions, getCalendarCells } from "../helpers.js"
import type { IEvent } from "../interfaces.js"
import { DayCell } from "./day-cell.js"

interface IProps {
  singleDayEvents: IEvent[]
  multiDayEvents: IEvent[]
  /** Optional callback when a day cell number is clicked. */
  onDayClick?: (date: Date) => void
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function CalendarMonthView({ singleDayEvents, multiDayEvents, onDayClick }: IProps) {
  const { selectedDate } = useCalendar()

  const allEvents = [...multiDayEvents, ...singleDayEvents]

  const cells = React.useMemo(() => getCalendarCells(selectedDate), [selectedDate])

  const eventPositions = React.useMemo(
    () => calculateMonthEventPositions(multiDayEvents, singleDayEvents, selectedDate),
    [multiDayEvents, singleDayEvents, selectedDate],
  )

  return (
    <div>
      <div className="grid grid-cols-7 divide-x">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="flex items-center justify-center py-2">
            <span className="text-xs font-medium text-muted-foreground">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden">
        {cells.map((cell) => (
          <DayCell
            key={cell.date.toISOString()}
            cell={cell}
            events={allEvents}
            eventPositions={eventPositions}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}
