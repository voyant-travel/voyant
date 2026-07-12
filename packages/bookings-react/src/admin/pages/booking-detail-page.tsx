"use client"

import { BookingDetailHost } from "../booking-detail-host.js"
import type { BookingDetailPageComponentProps } from "../index.js"

/**
 * Default packaged booking detail page (packaged-admin RFC §4.8):
 * {@link BookingDetailHost} with selected-package behavior supplied through
 * its stable widget slots. Finance owns payment dialogs without replacing
 * this route page.
 */
export default function BookingDetailDefaultPage({
  id,
  activeTab,
  onTabChange,
}: BookingDetailPageComponentProps) {
  return <BookingDetailHost id={id} activeTab={activeTab} onTabChange={onTabChange} />
}
