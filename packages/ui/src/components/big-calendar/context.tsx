"use client"

import * as React from "react"

import type { IEvent, IUser } from "./interfaces.js"
import type { TBadgeVariant, TVisibleHours, TWorkingHours } from "./types.js"

interface ICalendarContext {
  selectedDate: Date
  setSelectedDate: (date: Date | undefined) => void
  selectedUserId: IUser["id"] | "all"
  setSelectedUserId: (userId: IUser["id"] | "all") => void
  badgeVariant: TBadgeVariant
  setBadgeVariant: (variant: TBadgeVariant) => void
  users: IUser[]
  workingHours: TWorkingHours
  setWorkingHours: React.Dispatch<React.SetStateAction<TWorkingHours>>
  visibleHours: TVisibleHours
  setVisibleHours: React.Dispatch<React.SetStateAction<TVisibleHours>>
  events: IEvent[]
  /** Optional click handler — wires badges and event blocks to consumer routing/dialogs. */
  onEventClick?: (event: IEvent) => void
  /**
   * Optional add-event handler — wires the "Add" button in week/day grids and
   * the calendar header. When omitted, the inline add affordances are hidden.
   */
  onAddEvent?: (args: { date: Date; hour?: number; minute?: number }) => void
}

const CalendarContext = React.createContext<ICalendarContext | null>(null)

const DEFAULT_WORKING_HOURS: TWorkingHours = {
  0: { from: 0, to: 0 },
  1: { from: 8, to: 17 },
  2: { from: 8, to: 17 },
  3: { from: 8, to: 17 },
  4: { from: 8, to: 17 },
  5: { from: 8, to: 17 },
  6: { from: 8, to: 12 },
}

const DEFAULT_VISIBLE_HOURS: TVisibleHours = { from: 7, to: 18 }

interface CalendarProviderProps {
  children: React.ReactNode
  events: IEvent[]
  users?: IUser[]
  defaultSelectedDate?: Date
  defaultBadgeVariant?: TBadgeVariant
  defaultWorkingHours?: TWorkingHours
  defaultVisibleHours?: TVisibleHours
  onEventClick?: (event: IEvent) => void
  onAddEvent?: (args: { date: Date; hour?: number; minute?: number }) => void
}

export function CalendarProvider({
  children,
  events,
  users = [],
  defaultSelectedDate,
  defaultBadgeVariant = "colored",
  defaultWorkingHours = DEFAULT_WORKING_HOURS,
  defaultVisibleHours = DEFAULT_VISIBLE_HOURS,
  onEventClick,
  onAddEvent,
}: CalendarProviderProps) {
  const [badgeVariant, setBadgeVariant] = React.useState<TBadgeVariant>(defaultBadgeVariant)
  const [visibleHours, setVisibleHours] = React.useState<TVisibleHours>(defaultVisibleHours)
  const [workingHours, setWorkingHours] = React.useState<TWorkingHours>(defaultWorkingHours)

  const [selectedDate, setSelectedDate] = React.useState(() => defaultSelectedDate ?? new Date())
  const [selectedUserId, setSelectedUserId] = React.useState<IUser["id"] | "all">("all")

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
  }

  return (
    <CalendarContext.Provider
      value={{
        selectedDate,
        setSelectedDate: handleSelectDate,
        selectedUserId,
        setSelectedUserId,
        badgeVariant,
        setBadgeVariant,
        users,
        visibleHours,
        setVisibleHours,
        workingHours,
        setWorkingHours,
        events,
        onEventClick,
        onAddEvent,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar(): ICalendarContext {
  const context = React.useContext(CalendarContext)
  if (!context) throw new Error("useCalendar must be used within a CalendarProvider.")
  return context
}
