import type { IdentityUiMessages } from "./messages.js"

export const identityUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save Changes",
    primary: "Primary",
    addressLabelLabels: {
      primary: "Primary",
      billing: "Billing",
      shipping: "Shipping",
      mailing: "Mailing",
      meeting: "Meeting",
      service: "Service",
      legal: "Legal",
      other: "Other",
    },
    contactPointKindLabels: {
      email: "Email",
      phone: "Phone",
      mobile: "Mobile",
      whatsapp: "WhatsApp",
      website: "Website",
      sms: "SMS",
      fax: "Fax",
      social: "Social",
      other: "Other",
    },
    namedContactRoleLabels: {
      general: "General",
      primary: "Primary",
      reservations: "Reservations",
      operations: "Operations",
      front_desk: "Front desk",
      sales: "Sales",
      emergency: "Emergency",
      accounting: "Accounting",
      legal: "Legal",
      other: "Other",
    },
  },
  addressDialog: {
    titles: {
      create: "Add Address",
      edit: "Edit Address",
    },
    fields: {
      label: "Label",
      line1: "Line 1",
      line2: "Line 2",
      city: "City",
      region: "Region",
      postalCode: "Postal code",
      country: "Country",
      timezone: "Timezone",
      latitude: "Latitude",
      longitude: "Longitude",
      notes: "Notes",
    },
    placeholders: {
      timezone: "Europe/Istanbul",
    },
    actions: {
      create: "Add Address",
    },
  },
  contactPointDialog: {
    titles: {
      create: "Add Contact Point",
      edit: "Edit Contact Point",
    },
    fields: {
      kind: "Kind",
      label: "Label",
      value: "Value",
      notes: "Notes",
    },
    placeholders: {
      label: "work, personal...",
      value: "name@example.com",
    },
    actions: {
      create: "Add Contact Point",
    },
    validation: {
      valueRequired: "Value is required",
    },
  },
  namedContactDialog: {
    titles: {
      create: "Add Named Contact",
      edit: "Edit Named Contact",
    },
    fields: {
      role: "Role",
      name: "Name",
      title: "Title",
      email: "Email",
      phone: "Phone",
      notes: "Notes",
    },
    placeholders: {
      name: "Jane Doe",
      title: "Director of Sales",
      email: "jane@example.com",
    },
    actions: {
      create: "Add Named Contact",
    },
    validation: {
      nameRequired: "Name is required",
    },
  },
} satisfies IdentityUiMessages
