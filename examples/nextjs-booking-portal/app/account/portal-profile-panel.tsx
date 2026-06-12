"use client"

import {
  type CustomerPortalProfileDocumentRecord,
  useCustomerPortalMutation,
  useCustomerPortalProfile,
  useCustomerPortalProfileDocumentMutation,
  useCustomerPortalProfileDocuments,
} from "@voyantjs/customer-portal-react"
import { useEffect, useState } from "react"

import { getErrorMessage } from "./portal-client-utils.js"

type ProfileDocumentType = CustomerPortalProfileDocumentRecord["type"]

const PROFILE_DOCUMENT_TYPES: { value: ProfileDocumentType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "id_card", label: "ID card" },
  { value: "drivers_license", label: "Driver's license" },
  { value: "visa", label: "Visa" },
  { value: "other", label: "Other" },
]

export function ProfilePiiPanel() {
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
