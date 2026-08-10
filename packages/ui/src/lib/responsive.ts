/**
 * Shared class strings for making desktop-shaped admin screens usable on a
 * phone. They live here rather than in the components so the shadcn-style
 * primitives under `../components` stay untouched and upgradeable — every rule
 * below is applied by a consumer at its own call site.
 *
 * The breakpoint is `md` (768px) throughout: phones and portrait tablets get the
 * reduced treatment, everything from a landscape tablet up is unchanged.
 */

/**
 * A table column worth showing on a large screen but not worth a third of a
 * phone viewport.
 *
 * Admin list tables run to 6-10 columns and the leftmost ones are rarely the
 * decision-relevant ones — a bookings list would otherwise spend its visible
 * width on a created-at timestamp while status, total and travel dates sit off
 * the right edge. Mark the low-value columns with this so the ones that answer
 * "which booking is this and what state is it in" fit without scrolling.
 *
 * Apply to the `TableHead` **and** every matching `TableCell`, including
 * skeleton rows, or the columns will misalign while loading.
 */
export const SECONDARY_COLUMN_CLASS = "hidden md:table-cell"

/**
 * Checkbox/radio sized controls. Renders 20px with a 44px hit area on phones and
 * falls back to the stock 16px with no overlay from `md` up.
 *
 * iOS HIG asks for 44x44pt and Material for 48x48dp; row-selection checkboxes
 * render at 16px, which is hard to hit one-handed. Growing the control itself
 * would coarsen the desktop layout, so this grows the *hit area* with an
 * invisible inset overlay. A pseudo-element forwards clicks to its host, so the
 * overlay needs no event wiring.
 */
export const TOUCH_CHECKBOX_CLASS =
  "relative size-5 after:absolute after:-inset-3 after:content-[''] md:size-4 md:after:hidden"

/**
 * Icon-only buttons (sidebar trigger, row action menus). 44px on phones, stock
 * 32px from `md` up.
 */
export const TOUCH_ICON_BUTTON_CLASS = "size-11 md:size-8"
