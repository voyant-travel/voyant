"use client"

import { BookingDetailHost } from "../booking-detail-host.js"
import type { BookingDetailPageComponentProps } from "../index.js"

/**
 * Default packaged booking detail page (packaged-admin RFC §4.8):
 * {@link BookingDetailHost} with no app-owned dialogs wired. Hosts that need
 * to attach app-local flows (record-payment / payment-link dialogs, which
 * live app-side because the finance/checkout UI packages depend on this
 * package) substitute their own wrapper via
 * `CreateBookingsAdminExtensionOptions.detailPageComponent`.
 */
export default function BookingDetailDefaultPage({
  id,
  activeTab,
  onTabChange,
}: BookingDetailPageComponentProps) {
  return <BookingDetailHost id={id} activeTab={activeTab} onTabChange={onTabChange} />
}
