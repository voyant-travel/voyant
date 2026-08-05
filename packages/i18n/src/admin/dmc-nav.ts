import type { LocaleMessageDefinitions } from "../runtime.js"

export type DmcAdminNavMessages = {
  dashboard: string
  contacts: string
  suppliers: string
  products: string
  availability: string
  resources: string
  bookings: string
  notifications: string
  notificationTemplates: string
  notificationReminderRules: string
  notificationDeliveries: string
  notificationReminderRuns: string
  distribution: string
  finance: string
}

export const dmcAdminNavMessages = {
  en: {
    nav: {
      dashboard: "Dashboard",
      contacts: "Contacts",
      suppliers: "Suppliers",
      products: "Products",
      availability: "Availability",
      resources: "Resources",
      bookings: "Bookings",
      notifications: "Notifications",
      notificationTemplates: "Templates",
      notificationReminderRules: "Reminder Rules",
      notificationDeliveries: "Deliveries",
      notificationReminderRuns: "Reminder Runs",
      distribution: "Distribution",
      finance: "Finance",
    },
  },
  ro: {
    nav: {
      dashboard: "Panou",
      contacts: "Contacte",
      suppliers: "Furnizori",
      products: "Produse",
      availability: "Disponibilitate",
      resources: "Resurse",
      bookings: "Rezervari",
      notifications: "Notificari",
      notificationTemplates: "Sabloane",
      notificationReminderRules: "Reguli reminder",
      notificationDeliveries: "Livrari",
      notificationReminderRuns: "Executii reminder",
      distribution: "Distributie",
      finance: "Financiar",
    },
  },
  es: {
    nav: {
      dashboard: "Panel",
      contacts: "Contactos",
      suppliers: "Proveedores",
      products: "Productos",
      availability: "Disponibilidad",
      resources: "Recursos",
      bookings: "Reservas",
      notifications: "Notificaciones",
      notificationTemplates: "Plantillas",
      notificationReminderRules: "Reglas de recordatorio",
      notificationDeliveries: "Envíos",
      notificationReminderRuns: "Ejecuciones de recordatorios",
      distribution: "Distribución",
      finance: "Finanzas",
    },
  },
} satisfies LocaleMessageDefinitions<{ nav: DmcAdminNavMessages }>
