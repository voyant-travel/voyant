import type { TEventColor } from "./types.js"

export interface IUser {
  id: string
  name: string
  picturePath?: string | null
}

export interface IEvent {
  id: string
  startDate: string
  endDate: string
  title: string
  description?: string
  color: TEventColor
  user?: IUser
}

export interface ICalendarCell {
  day: number
  currentMonth: boolean
  date: Date
}
