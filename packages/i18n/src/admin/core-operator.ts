export type OperatorAdminCoreMessages = {
  createOrganization: string
  accountPage: {
    title: string
    description: string
    profileTitle: string
    profileDescription: string
    fullNameLabel: string
    emailLabel: string
    languageLabel: string
    timezoneLabel: string
    noValue: string
    emailSectionTitle: string
    emailSectionDescription: string
    currentEmailLabel: string
    newEmailLabel: string
    newEmailPlaceholder: string
    verificationCodeLabel: string
    verificationCodePlaceholder: string
    sendCode: string
    sendingCode: string
    verifyEmailChange: string
    verifyingEmailChange: string
    codeSentDescription: string
    emailChangeSuccess: string
    passwordSectionTitle: string
    passwordSectionDescription: string
    currentPasswordLabel: string
    newPasswordLabel: string
    confirmPasswordLabel: string
    updatePassword: string
    updatingPassword: string
    passwordChangeSuccess: string
    passwordsDoNotMatch: string
    passwordTooShort: string
    genericError: string
  }
}

export const operatorAdminCoreMessages = {
  en: {
    createOrganization: "Create organization",
    accountPage: {
      title: "Account",
      description: "Manage your sign-in email, password, and personal account settings.",
      profileTitle: "Profile",
      profileDescription: "Your current account details.",
      fullNameLabel: "Full name",
      emailLabel: "Email",
      languageLabel: "Language",
      timezoneLabel: "Timezone",
      noValue: "Not set",
      emailSectionTitle: "Change email",
      emailSectionDescription:
        "Send a verification code to your new email address, then confirm the change.",
      currentEmailLabel: "Current email",
      newEmailLabel: "New email",
      newEmailPlaceholder: "name@example.com",
      verificationCodeLabel: "Verification code",
      verificationCodePlaceholder: "Enter the 6-digit code",
      sendCode: "Send code",
      sendingCode: "Sending code...",
      verifyEmailChange: "Verify and change email",
      verifyingEmailChange: "Updating email...",
      codeSentDescription: "We sent a verification code to {email}.",
      emailChangeSuccess: "Your email address has been updated.",
      passwordSectionTitle: "Change password",
      passwordSectionDescription: "Use your current password to set a new one.",
      currentPasswordLabel: "Current password",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      updatePassword: "Update password",
      updatingPassword: "Updating password...",
      passwordChangeSuccess: "Your password has been updated.",
      passwordsDoNotMatch: "The new passwords do not match.",
      passwordTooShort: "The new password must be at least 8 characters.",
      genericError: "Something went wrong. Please try again.",
    },
  },
  ro: {
    createOrganization: "Creeaza organizatie",
    accountPage: {
      title: "Cont",
      description: "Gestioneaza emailul de autentificare, parola si setarile contului tau.",
      profileTitle: "Profil",
      profileDescription: "Detaliile curente ale contului tau.",
      fullNameLabel: "Nume complet",
      emailLabel: "Email",
      languageLabel: "Limba",
      timezoneLabel: "Fus orar",
      noValue: "Necompletat",
      emailSectionTitle: "Schimba emailul",
      emailSectionDescription:
        "Trimite un cod de verificare la noua adresa de email, apoi confirma modificarea.",
      currentEmailLabel: "Email curent",
      newEmailLabel: "Email nou",
      newEmailPlaceholder: "nume@exemplu.com",
      verificationCodeLabel: "Cod de verificare",
      verificationCodePlaceholder: "Introdu codul din 6 cifre",
      sendCode: "Trimite codul",
      sendingCode: "Se trimite codul...",
      verifyEmailChange: "Verifica si schimba emailul",
      verifyingEmailChange: "Se actualizeaza emailul...",
      codeSentDescription: "Am trimis un cod de verificare la {email}.",
      emailChangeSuccess: "Adresa de email a fost actualizata.",
      passwordSectionTitle: "Schimba parola",
      passwordSectionDescription: "Foloseste parola curenta pentru a seta una noua.",
      currentPasswordLabel: "Parola curenta",
      newPasswordLabel: "Parola noua",
      confirmPasswordLabel: "Confirma parola noua",
      updatePassword: "Actualizeaza parola",
      updatingPassword: "Se actualizeaza parola...",
      passwordChangeSuccess: "Parola a fost actualizata.",
      passwordsDoNotMatch: "Parolele noi nu se potrivesc.",
      passwordTooShort: "Parola noua trebuie sa aiba cel putin 8 caractere.",
      genericError: "A aparut o eroare. Incearca din nou.",
    },
  },
  es: {
    createOrganization: "Crear organización",
    accountPage: {
      title: "Cuenta",
      description:
        "Gestiona tu correo de inicio de sesión, tu contraseña y los ajustes de tu cuenta.",
      profileTitle: "Perfil",
      profileDescription: "Los datos actuales de tu cuenta.",
      fullNameLabel: "Nombre completo",
      emailLabel: "Correo electrónico",
      languageLabel: "Idioma",
      timezoneLabel: "Zona horaria",
      noValue: "Sin definir",
      emailSectionTitle: "Cambiar el correo electrónico",
      emailSectionDescription:
        "Envía un código de verificación a tu nueva dirección de correo y confirma el cambio.",
      currentEmailLabel: "Correo actual",
      newEmailLabel: "Correo nuevo",
      newEmailPlaceholder: "nombre@ejemplo.com",
      verificationCodeLabel: "Código de verificación",
      verificationCodePlaceholder: "Introduce el código de 6 dígitos",
      sendCode: "Enviar código",
      sendingCode: "Enviando el código...",
      verifyEmailChange: "Verificar y cambiar el correo",
      verifyingEmailChange: "Actualizando el correo...",
      codeSentDescription: "Hemos enviado un código de verificación a {email}.",
      emailChangeSuccess: "Tu dirección de correo se ha actualizado.",
      passwordSectionTitle: "Cambiar la contraseña",
      passwordSectionDescription: "Usa tu contraseña actual para establecer una nueva.",
      currentPasswordLabel: "Contraseña actual",
      newPasswordLabel: "Contraseña nueva",
      confirmPasswordLabel: "Confirma la contraseña nueva",
      updatePassword: "Actualizar la contraseña",
      updatingPassword: "Actualizando la contraseña...",
      passwordChangeSuccess: "Tu contraseña se ha actualizado.",
      passwordsDoNotMatch: "Las contraseñas nuevas no coinciden.",
      passwordTooShort: "La contraseña nueva debe tener al menos 8 caracteres.",
      genericError: "Algo ha salido mal. Inténtalo de nuevo.",
    },
  },
}
