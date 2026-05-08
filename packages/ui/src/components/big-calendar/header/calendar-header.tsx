import { CalendarRange, Columns, Grid2x2, Grid3x3, List, Plus } from "lucide-react"

import { Button } from "../../button.js"

import { useCalendar } from "../context.js"
import type { IEvent } from "../interfaces.js"
import type { TCalendarView } from "../types.js"
import { DateNavigator } from "./date-navigator.js"
import { TodayButton } from "./today-button.js"
import { UserSelect } from "./user-select.js"

interface IProps {
  view: TCalendarView
  events: IEvent[]
  onViewChange?: (view: TCalendarView) => void
  /** Which views to expose in the switcher. Defaults to day/week/month. */
  availableViews?: TCalendarView[]
}

const VIEW_ICONS: Record<TCalendarView, typeof List> = {
  day: List,
  week: Columns,
  month: Grid2x2,
  year: Grid3x3,
  agenda: CalendarRange,
}

const VIEW_LABELS: Record<TCalendarView, string> = {
  day: "View by day",
  week: "View by week",
  month: "View by month",
  year: "View by year",
  agenda: "View by agenda",
}

export function CalendarHeader({
  view,
  events,
  onViewChange,
  availableViews = ["day", "week", "month"],
}: IProps) {
  const { selectedDate, onAddEvent } = useCalendar()

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex first:rounded-r-none last:rounded-l-none [&:not(:first-child):not(:last-child)]:rounded-none">
            {availableViews.map((target, index) => {
              const Icon = VIEW_ICONS[target]
              const isFirst = index === 0
              const isLast = index === availableViews.length - 1
              return (
                <Button
                  key={target}
                  type="button"
                  aria-label={VIEW_LABELS[target]}
                  size="icon"
                  variant={view === target ? "default" : "outline"}
                  className={
                    isFirst
                      ? "rounded-r-none [&_svg]:size-5"
                      : isLast
                        ? "-ml-px rounded-l-none [&_svg]:size-5"
                        : "-ml-px rounded-none [&_svg]:size-5"
                  }
                  onClick={() => onViewChange?.(target)}
                >
                  <Icon strokeWidth={1.8} />
                </Button>
              )
            })}
          </div>

          <UserSelect />
        </div>

        {onAddEvent ? (
          <Button className="w-full sm:w-auto" onClick={() => onAddEvent({ date: selectedDate })}>
            <Plus />
            Add Event
          </Button>
        ) : null}
      </div>
    </div>
  )
}
