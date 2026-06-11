import type { SlotStatusTone } from "../index.js"

/**
 * Tailwind classes for the color-coded slot status badge. Pair with
 * `<Badge variant="outline" className={slotStatusToneClass[tone]}>`.
 *
 * Kept inside `availability-ui` (not `availability-react`) so the
 * Tailwind `@source` scan in operator/dmc templates picks the class
 * strings up — those templates only glob the UI packages.
 *
 * Palette mirrors `@voyantjs/bookings-react/ui`'s `StatusBadge` so slot
 * statuses sit alongside booking statuses with identical color and
 * weight.
 */
export const slotStatusToneClass: Record<SlotStatusTone, string> = {
  success: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "border-transparent bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  danger: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "",
}
