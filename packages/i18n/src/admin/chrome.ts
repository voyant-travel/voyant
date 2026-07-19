import type { LocaleMessageDefinitions } from "../runtime.js"

export type AdminChromeMessages = {
  loading: string
  account: string
  notifications: string
  logOut: string
  light: string
  dark: string
  language: string
  english: string
  romanian: string
  somethingWentWrong: string
  somethingWentWrongDetail: string
  requestFailed: string
  retry: string
  goToDashboard: string
  loadingAdminWorkspace: string
  loadingWorkspace: string
  pageNotFound: string
  pageNotFoundDescription: string
  soon: string
  beta: string
  toggleSidebar: string
  toggleSidebarShortcut: string
  unknownUser: string
  extensionLoading: string
  extensionLoadFailed: string
  extensionIncompatible: string
  appPageTitle: string
  appPageUnavailable: string
}

export const adminChromeMessages = {
  en: {
    loading: "Loading...",
    account: "Account",
    notifications: "Notifications",
    logOut: "Log out",
    light: "Light",
    dark: "Dark",
    language: "Language",
    english: "English",
    romanian: "Romanian",
    somethingWentWrong: "Something went wrong",
    somethingWentWrongDetail: "Something went wrong while loading this page.",
    requestFailed: "Request failed",
    retry: "Try again",
    goToDashboard: "Go to dashboard",
    loadingAdminWorkspace: "Loading admin workspace",
    loadingWorkspace: "Loading workspace",
    pageNotFound: "Page not found",
    pageNotFoundDescription: "The page you requested does not exist or is no longer available.",
    soon: "Soon",
    beta: "Beta",
    toggleSidebar: "Toggle sidebar",
    toggleSidebarShortcut: "Toggle sidebar (Cmd/Ctrl+B)",
    unknownUser: "Unknown user",
    extensionLoading: "Loading extension…",
    extensionLoadFailed: "This extension could not be loaded and was skipped.",
    extensionIncompatible:
      "This extension is incompatible with this admin version (requires {required}, admin provides {provided}).",
    appPageTitle: "App",
    appPageUnavailable: "This app page is no longer available.",
  },
  ro: {
    loading: "Se încarcă...",
    account: "Cont",
    notifications: "Notificări",
    logOut: "Deconectare",
    light: "Luminos",
    dark: "Întunecat",
    language: "Limbă",
    english: "Engleză",
    romanian: "Română",
    somethingWentWrong: "Ceva nu a funcționat",
    somethingWentWrongDetail: "A apărut o eroare la încărcarea acestei pagini.",
    requestFailed: "Solicitarea a eșuat",
    retry: "Încearcă din nou",
    goToDashboard: "Mergi la panou",
    loadingAdminWorkspace: "Se încarcă spațiul de administrare",
    loadingWorkspace: "Se încarcă spațiul de lucru",
    pageNotFound: "Pagina nu a fost găsită",
    pageNotFoundDescription: "Pagina solicitată nu există sau nu mai este disponibilă.",
    soon: "În curând",
    beta: "Beta",
    toggleSidebar: "Comută bara laterală",
    toggleSidebarShortcut: "Comută bara laterală (Cmd/Ctrl+B)",
    unknownUser: "Utilizator necunoscut",
    extensionLoading: "Se încarcă extensia…",
    extensionLoadFailed: "Extensia nu a putut fi încărcată și a fost omisă.",
    extensionIncompatible:
      "Extensia nu este compatibilă cu această versiune de administrare (necesită {required}, versiunea curentă oferă {provided}).",
    appPageTitle: "Aplicație",
    appPageUnavailable: "Această pagină de aplicație nu mai este disponibilă.",
  },
} satisfies LocaleMessageDefinitions<AdminChromeMessages>
