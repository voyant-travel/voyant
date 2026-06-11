"use client"

import { NumberSeriesPage } from "../components/number-series-page.js"
import { NumberSeriesDialog } from "./number-series-dialog.js"

/**
 * Packaged admin host for the operator-grade contract number series page
 * (packaged-admin RFC Phase 3). Zero-prop: the page navigates nowhere; the
 * create/edit dialog is the packaged {@link NumberSeriesDialog}.
 */
export function NumberSeriesHost() {
  return (
    <NumberSeriesPage renderNumberSeriesDialog={(props) => <NumberSeriesDialog {...props} />} />
  )
}
