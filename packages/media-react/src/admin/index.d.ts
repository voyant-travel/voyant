import { type MediaLibraryProps } from "../components/media-library.js"
export interface MediaLibraryAdminViewProps extends MediaLibraryProps {
  /** Active UI locale (falls back to English inside the messages provider). */
  locale?: string | null
  /** IANA time zone for locale-aware formatting. */
  timeZone?: string | null
}
/**
 * A ready-to-mount media-library admin view: the browse surface wrapped in its
 * own messages provider so a host can drop it onto a page without wiring the
 * i18n context itself. This is a standalone convenience mount — the operator
 * nav integration lands in a follow-up slice (voyant#3555).
 */
export declare function MediaLibraryAdminView({
  locale,
  timeZone,
  ...props
}: MediaLibraryAdminViewProps): import("react").JSX.Element
