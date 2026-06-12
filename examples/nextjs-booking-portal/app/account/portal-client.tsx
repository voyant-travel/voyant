// agent-quality: file-size exception -- owner: nextjs-booking-portal; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  type CustomerPortalProfileDocumentRecord,
  useCustomerPortalBooking,
  useCustomerPortalBookingDocuments,
  useCustomerPortalBookings,
  useCustomerPortalCompanions,
  useCustomerPortalContactExists,
  useCustomerPortalMutation,
  useCustomerPortalProfile,
  useCustomerPortalProfileDocumentMutation,
  useCustomerPortalProfileDocuments,
  VoyantApiError,
  VoyantCustomerPortalProvider,
} from "@voyantjs/customer-portal-react"
import {
  usePublicBookingPaymentOptions,
  usePublicPaymentSession,
  usePublicPaymentSessionMutation,
  usePublicVoucherValidationMutation,
  VoyantFinanceProvider,
} from "@voyantjs/finance-react"
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react"

interface CustomerAccountPanelProps {
  baseUrl: string
}

type ProfileDocumentType = CustomerPortalProfileDocumentRecord["type"]

const PROFILE_DOCUMENT_TYPES: { value: ProfileDocumentType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "id_card", label: "ID card" },
  { value: "drivers_license", label: "Driver's license" },
  { value: "visa", label: "Visa" },
  { value: "other", label: "Other" },
]

function getErrorMessage(error: unknown): string {
  if (error instanceof VoyantApiError) {
    if (error.status === 401) {
      return "Customer session required. Sign in on the Voyant public origin first, then reload this page."
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown error"
}

function ProfilePiiPanel() {
  const profileQuery = useCustomerPortalProfile()
  const documentsQuery = useCustomerPortalProfileDocuments({
    enabled: Boolean(profileQuery.data),
  })
  const { updateProfile } = useCustomerPortalMutation()
  const documentMutation = useCustomerPortalProfileDocumentMutation()

  const profile = profileQuery.data?.data ?? null
  const documents = documentsQuery.data?.data ?? []

  const [accessibility, setAccessibility] = useState("")
  const [dietary, setDietary] = useState("")
  const [loyalty, setLoyalty] = useState("")
  const [insurance, setInsurance] = useState("")
  const [piiSaved, setPiiSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setAccessibility(profile.accessibility ?? "")
    setDietary(profile.dietary ?? "")
    setLoyalty(profile.loyalty ?? "")
    setInsurance(profile.insurance ?? "")
  }, [profile])

  const [newDocType, setNewDocType] = useState<ProfileDocumentType>("passport")
  const [newDocNumber, setNewDocNumber] = useState("")
  const [newDocCountry, setNewDocCountry] = useState("")
  const [newDocExpiry, setNewDocExpiry] = useState("")
  const [newDocPrimary, setNewDocPrimary] = useState(false)

  if (!profile) {
    return null
  }

  const submitPii = (formData: FormData) => {
    void formData
    setPiiSaved(false)
    updateProfile.mutate(
      {
        accessibility: accessibility.trim() || null,
        dietary: dietary.trim() || null,
        loyalty: loyalty.trim() || null,
        insurance: insurance.trim() || null,
      },
      { onSuccess: () => setPiiSaved(true) },
    )
  }

  const submitDocument = (formData: FormData) => {
    void formData
    documentMutation.create.mutate(
      {
        type: newDocType,
        number: newDocNumber.trim() || null,
        issuingCountry: newDocCountry.trim() || null,
        expiryDate: newDocExpiry || null,
        isPrimary: newDocPrimary,
      },
      {
        onSuccess: () => {
          setNewDocNumber("")
          setNewDocCountry("")
          setNewDocExpiry("")
          setNewDocPrimary(false)
        },
      },
    )
  }

  return (
    <section className="account-panel">
      <h2>Identity & travel preferences</h2>
      <p className="muted-text">
        Saved to your profile and used to pre-fill future bookings. You can override per trip.
      </p>

      <form className="stack-sm" action={submitPii}>
        <div className="field">
          <label htmlFor="pii-accessibility">Accessibility needs</label>
          <textarea
            id="pii-accessibility"
            rows={2}
            value={accessibility}
            onChange={(event) => setAccessibility(event.target.value)}
            placeholder="e.g. wheelchair access, ground-floor room"
          />
        </div>
        <div className="field">
          <label htmlFor="pii-dietary">Dietary requirements</label>
          <textarea
            id="pii-dietary"
            rows={2}
            value={dietary}
            onChange={(event) => setDietary(event.target.value)}
            placeholder="e.g. gluten-free, vegetarian"
          />
        </div>
        <div className="field">
          <label htmlFor="pii-loyalty">Loyalty programs</label>
          <textarea
            id="pii-loyalty"
            rows={2}
            value={loyalty}
            onChange={(event) => setLoyalty(event.target.value)}
            placeholder="Frequent-flyer numbers, hotel statuses"
          />
        </div>
        <div className="field">
          <label htmlFor="pii-insurance">Travel insurance</label>
          <textarea
            id="pii-insurance"
            rows={2}
            value={insurance}
            onChange={(event) => setInsurance(event.target.value)}
            placeholder="Provider, policy number, coverage period"
          />
        </div>
        <button className="btn" type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving..." : "Save profile"}
        </button>
        {updateProfile.error ? (
          <p className="error-text">{getErrorMessage(updateProfile.error)}</p>
        ) : null}
        {piiSaved && !updateProfile.error ? <p className="muted-text">Saved.</p> : null}
      </form>

      <h3>Identity documents</h3>
      {documentsQuery.isLoading ? (
        <p className="muted-text">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="muted-text">
          No documents on file yet — add a passport or ID below to pre-fill it on future bookings.
        </p>
      ) : (
        <ul className="stack-sm">
          {documents.map((document) => (
            <li className="inline-card inline-card-tight" key={document.id}>
              <div>
                <strong>
                  {PROFILE_DOCUMENT_TYPES.find((entry) => entry.value === document.type)?.label ??
                    document.type}
                  {document.isPrimary ? " · primary" : ""}
                </strong>
                <div className="muted-text">
                  {document.number ?? "•••"}
                  {document.issuingCountry ? ` · ${document.issuingCountry}` : ""}
                  {document.expiryDate ? ` · expires ${document.expiryDate}` : ""}
                </div>
              </div>
              <div className="stack-sm">
                {document.isPrimary ? null : (
                  <button
                    className="btn"
                    type="button"
                    disabled={documentMutation.setPrimary.isPending}
                    onClick={() => documentMutation.setPrimary.mutate(document.id)}
                  >
                    Set primary
                  </button>
                )}
                <button
                  className="btn"
                  type="button"
                  disabled={documentMutation.remove.isPending}
                  onClick={() => documentMutation.remove.mutate(document.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h4>Add document</h4>
      <form className="stack-sm" action={submitDocument}>
        <div className="field">
          <label htmlFor="new-doc-type">Type</label>
          <select
            id="new-doc-type"
            value={newDocType}
            onChange={(event) => setNewDocType(event.target.value as ProfileDocumentType)}
          >
            {PROFILE_DOCUMENT_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="new-doc-number">Number</label>
          <input
            id="new-doc-number"
            value={newDocNumber}
            onChange={(event) => setNewDocNumber(event.target.value)}
            placeholder="Document number"
          />
        </div>
        <div className="field">
          <label htmlFor="new-doc-country">Issuing country</label>
          <input
            id="new-doc-country"
            value={newDocCountry}
            onChange={(event) => setNewDocCountry(event.target.value)}
            placeholder="ISO-2 code"
          />
        </div>
        <div className="field">
          <label htmlFor="new-doc-expiry">Expiry date</label>
          <input
            id="new-doc-expiry"
            type="date"
            value={newDocExpiry}
            onChange={(event) => setNewDocExpiry(event.target.value)}
          />
        </div>
        <label className="field-inline">
          <input
            type="checkbox"
            checked={newDocPrimary}
            onChange={(event) => setNewDocPrimary(event.target.checked)}
          />
          Use as primary document of this type
        </label>
        <button className="btn" type="submit" disabled={documentMutation.create.isPending}>
          {documentMutation.create.isPending ? "Saving..." : "Add document"}
        </button>
        {documentMutation.create.error ? (
          <p className="error-text">{getErrorMessage(documentMutation.create.error)}</p>
        ) : null}
      </form>
    </section>
  )
}

function PortalView() {
  const [lookupEmailInput, setLookupEmailInput] = useState("")
  const [lookupEmail, setLookupEmail] = useState<string | null>(null)
  const deferredLookupEmail = useDeferredValue(lookupEmail)

  const [bootstrapFirstName, setBootstrapFirstName] = useState("")
  const [bootstrapLastName, setBootstrapLastName] = useState("")
  const [companionName, setCompanionName] = useState("")
  const [companionEmail, setCompanionEmail] = useState("")
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [activePaymentSessionId, setActivePaymentSessionId] = useState<string | null>(null)
  const [voucherCode, setVoucherCode] = useState("")

  const profileQuery = useCustomerPortalProfile()
  const linkedCustomerRecordId = profileQuery.data?.data.customerRecord?.id ?? null
  const bookingsQuery = useCustomerPortalBookings({
    enabled: Boolean(linkedCustomerRecordId),
  })
  const bookingDetailQuery = useCustomerPortalBooking(selectedBookingId, {
    enabled: Boolean(selectedBookingId),
  })
  const bookingDocumentsQuery = useCustomerPortalBookingDocuments(selectedBookingId, {
    enabled: Boolean(selectedBookingId),
  })
  const paymentOptionsQuery = usePublicBookingPaymentOptions(selectedBookingId, {
    enabled: Boolean(selectedBookingId),
  })
  const paymentSessionQuery = usePublicPaymentSession(activePaymentSessionId, {
    enabled: Boolean(activePaymentSessionId),
  })
  const companionsQuery = useCustomerPortalCompanions({
    enabled: Boolean(linkedCustomerRecordId),
  })
  const contactExistsQuery = useCustomerPortalContactExists(deferredLookupEmail, {
    enabled: Boolean(deferredLookupEmail),
  })

  const { bootstrap, createCompanion } = useCustomerPortalMutation()
  const startPaymentSession = usePublicPaymentSessionMutation()
  const validateVoucher = usePublicVoucherValidationMutation()

  const bootstrapCandidates = bootstrap.data?.data.candidates ?? []
  const bootstrapResult = bootstrap.data?.data
  const profile = profileQuery.data?.data ?? null
  const bookings = bookingsQuery.data?.data ?? []
  const selectedBooking = bookingDetailQuery.data?.data ?? null
  const bookingDocuments = bookingDocumentsQuery.data?.data ?? []
  const paymentOptions = paymentOptionsQuery.data?.data ?? null
  const activePaymentSession =
    paymentSessionQuery.data?.data ?? startPaymentSession.data?.data ?? null
  const companions = companionsQuery.data?.data ?? []

  useEffect(() => {
    if (!selectedBookingId && bookings.length > 0) {
      setActivePaymentSessionId(null)
      setSelectedBookingId(bookings[0]?.bookingId ?? null)
      return
    }

    if (selectedBookingId && !bookings.some((booking) => booking.bookingId === selectedBookingId)) {
      setActivePaymentSessionId(null)
      setSelectedBookingId(bookings[0]?.bookingId ?? null)
    }
  }, [bookings, selectedBookingId])

  const submitLookup = (formData: FormData) => {
    const email = String(formData.get("email") ?? "").trim()
    startTransition(() => {
      setLookupEmail(email || null)
    })
  }

  const submitBootstrap = async (customerRecordId?: string) => {
    const payload = customerRecordId
      ? { customerRecordId, createCustomerIfMissing: false }
      : {
          firstName: bootstrapFirstName || undefined,
          lastName: bootstrapLastName || undefined,
          createCustomerIfMissing: true,
        }

    await bootstrap.mutateAsync(payload)
  }

  const submitCompanion = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()

    if (!name) return

    await createCompanion.mutateAsync({
      name,
      email: email || null,
      role: "general",
    })

    setCompanionName("")
    setCompanionEmail("")
  }

  const sessionState = useMemo(() => {
    if (profileQuery.isLoading) return "Loading customer profile..."
    if (profileQuery.error) return getErrorMessage(profileQuery.error)
    if (!profile) return "No customer profile loaded."
    if (profile.customerRecord) {
      return `Linked to customer record ${profile.customerRecord.id}.`
    }

    return "Signed in, but no customer record is linked yet."
  }, [profileQuery.error, profileQuery.isLoading, profile])

  const startCheckout = async (
    targetType: "booking_payment_schedule" | "booking_guarantee",
    targetId: string,
  ) => {
    if (!selectedBookingId) {
      return
    }

    const href = typeof window === "undefined" ? undefined : window.location.href
    const payerName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || undefined

    const result = await startPaymentSession.mutateAsync({
      targetType,
      bookingId: selectedBookingId,
      targetId,
      input: {
        payerEmail: profile?.email,
        payerName,
        returnUrl: href,
        cancelUrl: href,
      },
    })

    setActivePaymentSessionId(result.data.id)
  }

  const submitVoucher = async (formData: FormData) => {
    const code = String(formData.get("voucherCode") ?? "").trim()
    if (!code || !selectedBookingId) {
      return
    }

    await validateVoucher.mutateAsync({
      code,
      bookingId: selectedBookingId,
      currency: selectedBooking?.sellCurrency ?? null,
    })
  }

  const selectBooking = (bookingId: string) => {
    setActivePaymentSessionId(null)
    setSelectedBookingId(bookingId)
  }

  return (
    <div className="account-layout">
      <section className="account-panel">
        <h2>Session and profile</h2>
        <p className="muted-text">
          This surface expects an authenticated customer session cookie on the configured Voyant
          origin.
        </p>
        <div className="status-chip">{sessionState}</div>

        {profile ? (
          <dl className="detail-grid">
            <div>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>
                {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Not set"}
              </dd>
            </div>
            <div>
              <dt>Locale</dt>
              <dd>{profile.locale}</dd>
            </div>
            <div>
              <dt>Marketing</dt>
              <dd>{profile.marketingConsent ? "Subscribed" : "Not subscribed"}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <ProfilePiiPanel />

      <section className="account-panel">
        <h2>Contact preflight</h2>
        <p className="muted-text">
          Check whether an email already has an auth account or CRM customer record before trying to
          bootstrap a customer profile.
        </p>
        <form className="stack-sm" action={submitLookup}>
          <div className="field">
            <label htmlFor="lookup-email">Email</label>
            <input
              id="lookup-email"
              name="email"
              type="email"
              value={lookupEmailInput}
              onChange={(event) => setLookupEmailInput(event.target.value)}
              placeholder="traveler@example.com"
            />
          </div>
          <button className="btn" type="submit">
            Check contact
          </button>
        </form>

        {contactExistsQuery.data ? (
          <dl className="detail-grid">
            <div>
              <dt>Auth account</dt>
              <dd>{contactExistsQuery.data.data.authAccountExists ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Customer record</dt>
              <dd>{contactExistsQuery.data.data.customerRecordExists ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Linked record</dt>
              <dd>{contactExistsQuery.data.data.linkedCustomerRecordExists ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : null}

        {contactExistsQuery.error ? (
          <p className="error-text">{getErrorMessage(contactExistsQuery.error)}</p>
        ) : null}
      </section>

      <section className="account-panel">
        <h2>Bootstrap customer record</h2>
        <p className="muted-text">
          Use the authenticated bootstrap route to link an existing CRM customer or create a new one
          for the current account.
        </p>
        <div className="field-row">
          <div className="field">
            <label htmlFor="bootstrap-first-name">First name</label>
            <input
              id="bootstrap-first-name"
              value={bootstrapFirstName}
              onChange={(event) => setBootstrapFirstName(event.target.value)}
              placeholder={profile?.firstName ?? "Ana"}
            />
          </div>
          <div className="field">
            <label htmlFor="bootstrap-last-name">Last name</label>
            <input
              id="bootstrap-last-name"
              value={bootstrapLastName}
              onChange={(event) => setBootstrapLastName(event.target.value)}
              placeholder={profile?.lastName ?? "Popescu"}
            />
          </div>
        </div>
        <div className="button-row">
          <button
            className="btn"
            type="button"
            onClick={() => void submitBootstrap()}
            disabled={bootstrap.isPending}
          >
            {bootstrap.isPending ? "Linking..." : "Create or link customer"}
          </button>
        </div>

        {bootstrapResult ? (
          <div className="callout success-callout">
            <strong>Bootstrap status:</strong> {bootstrapResult.status}
          </div>
        ) : null}

        {bootstrapCandidates.length > 0 ? (
          <div className="stack-sm">
            <h3>Candidate customer records</h3>
            {bootstrapCandidates.map((candidate) => (
              <div key={candidate.id} className="inline-card">
                <div>
                  <strong>
                    {candidate.firstName} {candidate.lastName}
                  </strong>
                  <div className="muted-text">{candidate.email ?? "No email"}</div>
                </div>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => void submitBootstrap(candidate.id)}
                  disabled={bootstrap.isPending || !candidate.linkable}
                >
                  {candidate.linkable ? "Link this record" : "Already claimed"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {bootstrap.error ? <p className="error-text">{getErrorMessage(bootstrap.error)}</p> : null}
      </section>

      <section className="account-panel">
        <h2>Companions</h2>
        <p className="muted-text">
          Simple companion management built on the shared customer portal hooks.
        </p>

        <form className="stack-sm" action={submitCompanion}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="companion-name">Name</label>
              <input
                id="companion-name"
                name="name"
                value={companionName}
                onChange={(event) => setCompanionName(event.target.value)}
                placeholder="Travel companion"
              />
            </div>
            <div className="field">
              <label htmlFor="companion-email">Email</label>
              <input
                id="companion-email"
                name="email"
                type="email"
                value={companionEmail}
                onChange={(event) => setCompanionEmail(event.target.value)}
                placeholder="companion@example.com"
              />
            </div>
          </div>
          <button
            className="btn"
            type="submit"
            disabled={createCompanion.isPending || !linkedCustomerRecordId}
          >
            {createCompanion.isPending ? "Saving..." : "Add companion"}
          </button>
        </form>

        {!linkedCustomerRecordId ? (
          <p className="muted-text">Bootstrap a customer record before managing companions.</p>
        ) : null}
        {createCompanion.error ? (
          <p className="error-text">{getErrorMessage(createCompanion.error)}</p>
        ) : null}
        {companionsQuery.error ? (
          <p className="error-text">{getErrorMessage(companionsQuery.error)}</p>
        ) : null}
        {companions.length > 0 ? (
          <div className="stack-sm">
            {companions.map((companion) => (
              <div key={companion.id} className="inline-card">
                <div>
                  <strong>{companion.name}</strong>
                  <div className="muted-text">{companion.email ?? "No email"}</div>
                </div>
                <span className="status-chip">{companion.role}</span>
              </div>
            ))}
          </div>
        ) : linkedCustomerRecordId && !companionsQuery.isLoading ? (
          <p className="muted-text">No companions yet.</p>
        ) : null}
      </section>

      <section className="account-panel">
        <h2>Bookings</h2>
        <p className="muted-text">
          Customer-scoped bookings are available once the authenticated account is linked to a CRM
          customer record.
        </p>

        {bookingsQuery.error ? (
          <p className="error-text">{getErrorMessage(bookingsQuery.error)}</p>
        ) : null}
        {bookings.length > 0 ? (
          <div className="stack-sm">
            {bookings.map((booking) => (
              <div
                key={booking.bookingId}
                className={`booking-row${selectedBookingId === booking.bookingId ? " booking-row-selected" : ""}`}
              >
                <div>
                  <strong>{booking.bookingNumber}</strong>
                  <div className="muted-text">
                    {booking.startDate ?? "Open date"} to {booking.endDate ?? "Open date"}
                  </div>
                </div>
                <div className="booking-row-meta">
                  <span className="status-chip">{booking.status}</span>
                  <span>
                    {booking.sellCurrency} {booking.sellAmountCents ?? 0}
                  </span>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => selectBooking(booking.bookingId)}
                  >
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : linkedCustomerRecordId && !bookingsQuery.isLoading ? (
          <p className="muted-text">No bookings were returned for this customer account.</p>
        ) : null}

        {selectedBookingId ? (
          <div className="booking-detail-panel">
            <div className="booking-detail-header">
              <div>
                <h3>Selected booking</h3>
                <p className="muted-text">
                  Detail and document reads are separate hooks so customer apps can cache them
                  independently.
                </p>
              </div>
              <span className="status-chip">{selectedBooking?.status ?? "loading"}</span>
            </div>

            {bookingDetailQuery.error ? (
              <p className="error-text">{getErrorMessage(bookingDetailQuery.error)}</p>
            ) : null}

            {selectedBooking ? (
              <>
                <dl className="detail-grid">
                  <div>
                    <dt>Booking number</dt>
                    <dd>{selectedBooking.bookingNumber}</dd>
                  </div>
                  <div>
                    <dt>Travel window</dt>
                    <dd>
                      {selectedBooking.startDate ?? "Open date"} to{" "}
                      {selectedBooking.endDate ?? "Open date"}
                    </dd>
                  </div>
                  <div>
                    <dt>Travelers</dt>
                    <dd>{selectedBooking.travelers.length}</dd>
                  </div>
                  <div>
                    <dt>Items</dt>
                    <dd>{selectedBooking.items.length}</dd>
                  </div>
                </dl>

                <div className="detail-columns">
                  <div className="stack-sm">
                    <h4>Travelers</h4>
                    {selectedBooking.travelers.map((traveler) => (
                      <div key={traveler.id} className="inline-card inline-card-tight">
                        <div>
                          <strong>
                            {traveler.firstName} {traveler.lastName}
                          </strong>
                          <div className="muted-text">{traveler.participantType}</div>
                        </div>
                        {traveler.isPrimary ? <span className="status-chip">Primary</span> : null}
                      </div>
                    ))}
                  </div>

                  <div className="stack-sm">
                    <h4>Booked items</h4>
                    {selectedBooking.items.map((item) => (
                      <div key={item.id} className="inline-card inline-card-tight">
                        <div>
                          <strong>{item.title}</strong>
                          <div className="muted-text">
                            {item.itemType} · qty {item.quantity}
                          </div>
                        </div>
                        <span className="status-chip">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <div className="stack-sm">
              <h4>Documents</h4>
              {bookingDocumentsQuery.error ? (
                <p className="error-text">{getErrorMessage(bookingDocumentsQuery.error)}</p>
              ) : null}
              {bookingDocuments.length > 0
                ? bookingDocuments.map((document) => (
                    <a
                      key={document.id}
                      href={document.fileUrl}
                      className="inline-card inline-card-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div>
                        <strong>{document.fileName}</strong>
                        <div className="muted-text">{document.type}</div>
                      </div>
                      <span className="status-chip">Open</span>
                    </a>
                  ))
                : !bookingDocumentsQuery.isLoading && (
                    <p className="muted-text">
                      No customer documents were returned for this booking.
                    </p>
                  )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="account-panel">
        <h2>Payments and vouchers</h2>
        <p className="muted-text">
          Public checkout consumers should not reverse-engineer finance internals. This reference
          panel uses the shared finance public hooks for payment options, payment-session start, and
          voucher validation.
        </p>

        {!selectedBookingId ? (
          <p className="muted-text">Select a booking to inspect payment options.</p>
        ) : null}

        {paymentOptionsQuery.error ? (
          <p className="error-text">{getErrorMessage(paymentOptionsQuery.error)}</p>
        ) : null}

        {paymentOptions ? (
          <div className="stack-sm">
            {paymentOptions.recommendedTarget?.targetType ? (
              <div className="callout success-callout">
                <strong>Recommended target:</strong> {paymentOptions.recommendedTarget.targetType}
              </div>
            ) : null}

            <div className="detail-columns">
              <div className="stack-sm">
                <h3>Payment accounts</h3>
                {paymentOptions.accounts.length > 0 ? (
                  paymentOptions.accounts.map((account) => (
                    <div key={account.id} className="inline-card inline-card-tight">
                      <div>
                        <strong>{account.label}</strong>
                        <div className="muted-text">
                          {account.provider ?? "manual"} · {account.instrumentType}
                        </div>
                      </div>
                      {account.isDefault ? <span className="status-chip">Default</span> : null}
                    </div>
                  ))
                ) : (
                  <p className="muted-text">No active customer payment accounts were returned.</p>
                )}
              </div>

              <div className="stack-sm">
                <h3>Schedule targets</h3>
                {paymentOptions.schedules.length > 0 ? (
                  paymentOptions.schedules.map((schedule) => (
                    <div key={schedule.id} className="inline-card">
                      <div>
                        <strong>{schedule.scheduleType}</strong>
                        <div className="muted-text">
                          Due {schedule.dueDate} · {schedule.currency} {schedule.amountCents}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => void startCheckout("booking_payment_schedule", schedule.id)}
                        disabled={startPaymentSession.isPending}
                      >
                        Pay schedule
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted-text">No open booking payment schedules were returned.</p>
                )}
              </div>
            </div>

            <div className="stack-sm">
              <h3>Guarantee targets</h3>
              {paymentOptions.guarantees.length > 0 ? (
                paymentOptions.guarantees.map((guarantee) => (
                  <div key={guarantee.id} className="inline-card">
                    <div>
                      <strong>{guarantee.guaranteeType}</strong>
                      <div className="muted-text">
                        {guarantee.currency ?? selectedBooking?.sellCurrency ?? "n/a"}{" "}
                        {guarantee.amountCents ?? 0}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => void startCheckout("booking_guarantee", guarantee.id)}
                      disabled={startPaymentSession.isPending}
                    >
                      Pay guarantee
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted-text">No guarantee payment targets were returned.</p>
              )}
            </div>

            <div className="stack-sm">
              <h3>Voucher validation</h3>
              <form className="stack-sm" action={submitVoucher}>
                <div className="field">
                  <label htmlFor="voucherCode">Voucher code</label>
                  <input
                    id="voucherCode"
                    name="voucherCode"
                    value={voucherCode}
                    onChange={(event) => setVoucherCode(event.target.value)}
                    placeholder="SPRING-2026"
                  />
                </div>
                <button
                  className="btn"
                  type="submit"
                  disabled={validateVoucher.isPending || !selectedBookingId}
                >
                  {validateVoucher.isPending ? "Validating..." : "Validate voucher"}
                </button>
              </form>

              {validateVoucher.error ? (
                <p className="error-text">{getErrorMessage(validateVoucher.error)}</p>
              ) : null}
              {validateVoucher.data ? (
                <div className="inline-card inline-card-tight">
                  <div>
                    <strong>
                      {validateVoucher.data.data.valid ? "Voucher accepted" : "Voucher rejected"}
                    </strong>
                    <div className="muted-text">
                      {validateVoucher.data.data.reason ?? "valid"}
                      {validateVoucher.data.data.voucher?.label
                        ? ` · ${validateVoucher.data.data.voucher.label}`
                        : ""}
                    </div>
                  </div>
                  <span className="status-chip">
                    {validateVoucher.data.data.voucher?.remainingAmountCents ?? 0}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="stack-sm">
              <h3>Payment session</h3>
              {startPaymentSession.error ? (
                <p className="error-text">{getErrorMessage(startPaymentSession.error)}</p>
              ) : null}
              {paymentSessionQuery.error ? (
                <p className="error-text">{getErrorMessage(paymentSessionQuery.error)}</p>
              ) : null}
              {activePaymentSession ? (
                <div className="callout payment-session-callout">
                  <div className="payment-session-grid">
                    <div>
                      <strong>Session</strong>
                      <div className="muted-text">{activePaymentSession.id}</div>
                    </div>
                    <div>
                      <strong>Status</strong>
                      <div className="muted-text">{activePaymentSession.status}</div>
                    </div>
                    <div>
                      <strong>Amount</strong>
                      <div className="muted-text">
                        {activePaymentSession.currency} {activePaymentSession.amountCents}
                      </div>
                    </div>
                    <div>
                      <strong>Provider</strong>
                      <div className="muted-text">{activePaymentSession.provider ?? "manual"}</div>
                    </div>
                  </div>
                  {activePaymentSession.redirectUrl ? (
                    <a
                      className="btn"
                      href={activePaymentSession.redirectUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open payment redirect
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="muted-text">
                  Start a schedule or guarantee payment session to see the public checkout handoff.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export function CustomerAccountPanel({ baseUrl }: CustomerAccountPanelProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <VoyantCustomerPortalProvider baseUrl={baseUrl}>
        <VoyantFinanceProvider baseUrl={baseUrl}>
          <PortalView />
        </VoyantFinanceProvider>
      </VoyantCustomerPortalProvider>
    </QueryClientProvider>
  )
}
