"use client"

import { isSameDay, parseISO } from "date-fns"
import * as React from "react"

import { useCalendar } from "./context.js"
import { CalendarHeader } from "./header/calendar-header.js"
import { CalendarMonthView } from "./month-view/calendar-month-view.js"
import type { TCalendarView } from "./types.js"
import { CalendarDayView } from "./week-and-day-view/calendar-day-view.js"
import { CalendarWeekView } from "./week-and-day-view/calendar-week-view.js"

interface IProps {
  view: TCalendarView
  onViewChange?: (view: TCalendarView) => void
  /** Override default switcher set (`day`, `week`, `month`). */
  availableViews?: TCalendarView[]
  /** Forwarded to the month view's day-number button. */
  onDayClick?: (date: Date) => void
  className?: string
}

export function CalendarView({
  view,
  onViewChange,
  availableViews,
  onDayClick,
  className,
}: IProps) {
  const { selectedDate, selectedUserId, events } = useCalendar()

  const filteredEvents = React.useMemo(() => {
    return events.filter((event) => {
      const eventStartDate = parseISO(event.startDate)
      const eventEndDate = parseISO(event.endDate)
      const isUserMatch = selectedUserId === "all" || event.user?.id === selectedUserId

      if (view === "month" || view === "agenda" || view === "year") {
        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        const monthEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        )
        return eventStartDate <= monthEnd && eventEndDate >= monthStart && isUserMatch
      }

      if (view === "week") {
        const dayOfWeek = selectedDate.getDay()
        const weekStart = new Date(selectedDate)
        weekStart.setDate(selectedDate.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)
        return eventStartDate <= weekEnd && eventEndDate >= weekStart && isUserMatch
      }

      if (view === "day") {
        const dayStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0,
        )
        const dayEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59,
        )
        return eventStartDate <= dayEnd && eventEndDate >= dayStart && isUserMatch
      }

      return false
    })
  }, [selectedDate, selectedUserId, events, view])

  const singleDayEvents = filteredEvents.filter((event) => {
    const startDate = parseISO(event.startDate)
    const endDate = parseISO(event.endDate)
    return isSameDay(startDate, endDate)
  })

  const multiDayEvents = filteredEvents.filter((event) => {
    const startDate = parseISO(event.startDate)
    const endDate = parseISO(event.endDate)
    return !isSameDay(startDate, endDate)
  })

  return (
    <div className={`overflow-hidden rounded-xl border ${className ?? ""}`.trim()}>
      <CalendarHeader
        view={view}
        events={filteredEvents}
        onViewChange={onViewChange}
        availableViews={availableViews}
      />

      {view === "day" ? (
        <CalendarDayView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />
      ) : null}
      {view === "week" ? (
        <CalendarWeekView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />
      ) : null}
      {view === "month" ? (
        <CalendarMonthView
          singleDayEvents={singleDayEvents}
          multiDayEvents={multiDayEvents}
          onDayClick={onDayClick}
        />
      ) : null}
    </div>
  )
}
