"use client"
import { jsx as _jsx } from "react/jsx-runtime"
import { MediaLibrary } from "../components/media-library.js"
import { MediaUiMessagesProvider } from "../i18n/provider.js"
/**
 * A ready-to-mount media-library admin view: the browse surface wrapped in its
 * own messages provider so a host can drop it onto a page without wiring the
 * i18n context itself. This is a standalone convenience mount — the operator
 * nav integration lands in a follow-up slice (voyant#3555).
 */
export function MediaLibraryAdminView({ locale, timeZone, ...props }) {
  return _jsx(MediaUiMessagesProvider, {
    locale: locale ?? null,
    timeZone: timeZone,
    children: _jsx(MediaLibrary, { ...props }),
  })
}
