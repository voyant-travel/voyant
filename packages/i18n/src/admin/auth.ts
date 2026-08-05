import type { LocaleMessageDefinitions } from "../runtime.js"

export type AdminAuthMessages = {
  signIn: {
    title: string
    description: string
    emailNotVerified: string
    invalidEmailOrPassword: string
    somethingWentWrong: string
    resendVerificationCode: string
    sending: string
    emailLabel: string
    emailPlaceholder: string
    passwordLabel: string
    forgotPassword: string
    submit: string
    or: string
    continueWithGoogle: string
  }
  signUp: {
    title: string
    description: string
    couldNotCreateAccount: string
    somethingWentWrong: string
    fullNameLabel: string
    fullNamePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    passwordLabel: string
    submit: string
    or: string
    continueWithGoogle: string
  }
  forgotPassword: {
    checkEmailTitle: string
    checkEmailDescription: string
    backToSignIn: string
    title: string
    description: string
    couldNotSendResetEmail: string
    somethingWentWrong: string
    emailLabel: string
    emailPlaceholder: string
    submit: string
  }
  resetPassword: {
    title: string
    description: string
    passwordsDoNotMatch: string
    missingResetToken: string
    couldNotResetPassword: string
    somethingWentWrong: string
    newPasswordLabel: string
    confirmPasswordLabel: string
    submit: string
    backToSignIn: string
  }
  verifyEmail: {
    title: string
    description: string
    invalidVerificationCode: string
    somethingWentWrong: string
    resendFailed: string
    resent: string
    submit: string
    resendCode: string
    sending: string
  }
  acceptInvite: {
    signInAfterRedeemFailed: string
    couldNotAcceptInvitation: string
    invitationUnavailableTitle: string
    invitationAlreadyUsed: string
    invitationExpired: string
    invitationInvalid: string
    title: string
    description: string
    fullNameLabel: string
    passwordLabel: string
    submit: string
  }
}

export const adminAuthMessages = {
  en: {
    auth: {
      signIn: {
        title: "Sign in",
        description: "Sign in to your account to continue",
        emailNotVerified:
          "Your email address has not been verified. Please check your inbox or resend the verification code.",
        invalidEmailOrPassword: "Invalid email or password",
        somethingWentWrong: "Something went wrong. Please try again.",
        resendVerificationCode: "Resend verification code",
        sending: "Sending...",
        emailLabel: "Email",
        emailPlaceholder: "you@company.com",
        passwordLabel: "Password",
        forgotPassword: "Forgot password?",
        submit: "Sign in",
        or: "or",
        continueWithGoogle: "Continue with Google",
      },
      signUp: {
        title: "Create the first admin",
        description:
          "This workspace has no users yet. The account you create will become the super-admin - everyone else joins via invitation.",
        couldNotCreateAccount: "Could not create account",
        somethingWentWrong: "Something went wrong. Please try again.",
        fullNameLabel: "Full name",
        fullNamePlaceholder: "Jane Smith",
        emailLabel: "Email",
        emailPlaceholder: "you@company.com",
        passwordLabel: "Password",
        submit: "Create account",
        or: "or",
        continueWithGoogle: "Continue with Google",
      },
      forgotPassword: {
        checkEmailTitle: "Check your email",
        checkEmailDescription:
          "We sent a password reset link to {email}. Follow the link in the email to reset your password.",
        backToSignIn: "Back to sign in",
        title: "Forgot password",
        description: "Enter your email and we'll send you a reset link",
        couldNotSendResetEmail: "Could not send reset email",
        somethingWentWrong: "Something went wrong. Please try again.",
        emailLabel: "Email",
        emailPlaceholder: "you@company.com",
        submit: "Send reset link",
      },
      resetPassword: {
        title: "Reset password",
        description: "Enter your new password",
        passwordsDoNotMatch: "Passwords do not match",
        missingResetToken: "Missing reset token. Please use the link from your email.",
        couldNotResetPassword: "Could not reset password",
        somethingWentWrong: "Something went wrong. Please try again.",
        newPasswordLabel: "New password",
        confirmPasswordLabel: "Confirm password",
        submit: "Reset password",
        backToSignIn: "Back to sign in",
      },
      verifyEmail: {
        title: "Verify your email",
        description: "We sent a 6-digit code to {email}",
        invalidVerificationCode: "Invalid verification code",
        somethingWentWrong: "Something went wrong. Please try again.",
        resendFailed: "Failed to resend code. Please try again.",
        resent: "A new code has been sent to your email.",
        submit: "Verify email",
        resendCode: "Resend code",
        sending: "Sending...",
      },
      acceptInvite: {
        signInAfterRedeemFailed: "Sign-in after redeem failed",
        couldNotAcceptInvitation: "Could not accept invitation",
        invitationUnavailableTitle: "Invitation unavailable",
        invitationAlreadyUsed: "This invitation has already been used.",
        invitationExpired: "This invitation has expired. Ask an admin for a new one.",
        invitationInvalid: "This invitation link isn't valid.",
        title: "Accept your invitation",
        description:
          "You've been invited to join as {email}. Set your name and password to finish creating your account.",
        fullNameLabel: "Full name",
        passwordLabel: "Password",
        submit: "Accept invitation",
      },
    },
  },
  ro: {
    auth: {
      signIn: {
        title: "Autentificare",
        description: "Autentifica-te pentru a continua",
        emailNotVerified:
          "Adresa de email nu a fost verificata. Verifica inbox-ul sau retrimite codul de verificare.",
        invalidEmailOrPassword: "Email sau parola invalida",
        somethingWentWrong: "A aparut o problema. Incearca din nou.",
        resendVerificationCode: "Retrimite codul de verificare",
        sending: "Se trimite...",
        emailLabel: "Email",
        emailPlaceholder: "tu@companie.com",
        passwordLabel: "Parola",
        forgotPassword: "Ai uitat parola?",
        submit: "Autentificare",
        or: "sau",
        continueWithGoogle: "Continua cu Google",
      },
      signUp: {
        title: "Creeaza primul administrator",
        description:
          "Acest spatiu de lucru nu are inca utilizatori. Contul creat va deveni super-admin, iar ceilalti se vor alatura prin invitatie.",
        couldNotCreateAccount: "Contul nu a putut fi creat",
        somethingWentWrong: "A aparut o problema. Incearca din nou.",
        fullNameLabel: "Nume complet",
        fullNamePlaceholder: "Ana Popescu",
        emailLabel: "Email",
        emailPlaceholder: "tu@companie.com",
        passwordLabel: "Parola",
        submit: "Creeaza cont",
        or: "sau",
        continueWithGoogle: "Continua cu Google",
      },
      forgotPassword: {
        checkEmailTitle: "Verifica emailul",
        checkEmailDescription:
          "Am trimis un link de resetare la {email}. Urmeaza linkul din email pentru a-ti reseta parola.",
        backToSignIn: "Inapoi la autentificare",
        title: "Ai uitat parola",
        description: "Introdu emailul si iti trimitem un link de resetare",
        couldNotSendResetEmail: "Emailul de resetare nu a putut fi trimis",
        somethingWentWrong: "A aparut o problema. Incearca din nou.",
        emailLabel: "Email",
        emailPlaceholder: "tu@companie.com",
        submit: "Trimite linkul de resetare",
      },
      resetPassword: {
        title: "Reseteaza parola",
        description: "Introdu parola noua",
        passwordsDoNotMatch: "Parolele nu coincid",
        missingResetToken: "Lipseste tokenul de resetare. Foloseste linkul primit pe email.",
        couldNotResetPassword: "Parola nu a putut fi resetata",
        somethingWentWrong: "A aparut o problema. Incearca din nou.",
        newPasswordLabel: "Parola noua",
        confirmPasswordLabel: "Confirma parola",
        submit: "Reseteaza parola",
        backToSignIn: "Inapoi la autentificare",
      },
      verifyEmail: {
        title: "Verifica emailul",
        description: "Am trimis un cod de 6 cifre la {email}",
        invalidVerificationCode: "Cod de verificare invalid",
        somethingWentWrong: "A aparut o problema. Incearca din nou.",
        resendFailed: "Codul nu a putut fi retrimis. Incearca din nou.",
        resent: "Un cod nou a fost trimis pe email.",
        submit: "Verifica emailul",
        resendCode: "Retrimite codul",
        sending: "Se trimite...",
      },
      acceptInvite: {
        signInAfterRedeemFailed: "Autentificarea dupa acceptarea invitatiei a esuat",
        couldNotAcceptInvitation: "Invitatia nu a putut fi acceptata",
        invitationUnavailableTitle: "Invitatie indisponibila",
        invitationAlreadyUsed: "Aceasta invitatie a fost deja folosita.",
        invitationExpired: "Aceasta invitatie a expirat. Cere unui administrator o invitatie noua.",
        invitationInvalid: "Acest link de invitatie nu este valid.",
        title: "Accepta invitatia",
        description:
          "Ai fost invitat sa te alaturi ca {email}. Seteaza-ti numele si parola pentru a finaliza contul.",
        fullNameLabel: "Nume complet",
        passwordLabel: "Parola",
        submit: "Accepta invitatia",
      },
    },
  },
  es: {
    auth: {
      signIn: {
        title: "Iniciar sesión",
        description: "Inicia sesión en tu cuenta para continuar",
        emailNotVerified:
          "Tu dirección de correo no se ha verificado. Revisa tu bandeja de entrada o vuelve a enviar el código de verificación.",
        invalidEmailOrPassword: "Correo o contraseña incorrectos",
        somethingWentWrong: "Algo ha salido mal. Inténtalo de nuevo.",
        resendVerificationCode: "Reenviar el código de verificación",
        sending: "Enviando...",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "tu@empresa.com",
        passwordLabel: "Contraseña",
        forgotPassword: "¿Has olvidado la contraseña?",
        submit: "Iniciar sesión",
        or: "o",
        continueWithGoogle: "Continuar con Google",
      },
      signUp: {
        title: "Crea el primer administrador",
        description:
          "Este espacio de trabajo aún no tiene usuarios. La cuenta que crees será la de superadministrador; el resto se unirá por invitación.",
        couldNotCreateAccount: "No se ha podido crear la cuenta",
        somethingWentWrong: "Algo ha salido mal. Inténtalo de nuevo.",
        fullNameLabel: "Nombre completo",
        fullNamePlaceholder: "Ana García",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "tu@empresa.com",
        passwordLabel: "Contraseña",
        submit: "Crear cuenta",
        or: "o",
        continueWithGoogle: "Continuar con Google",
      },
      forgotPassword: {
        checkEmailTitle: "Revisa tu correo",
        checkEmailDescription:
          "Hemos enviado un enlace para restablecer la contraseña a {email}. Sigue el enlace del correo para restablecerla.",
        backToSignIn: "Volver al inicio de sesión",
        title: "Contraseña olvidada",
        description: "Introduce tu correo y te enviaremos un enlace para restablecerla",
        couldNotSendResetEmail: "No se ha podido enviar el correo de restablecimiento",
        somethingWentWrong: "Algo ha salido mal. Inténtalo de nuevo.",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "tu@empresa.com",
        submit: "Enviar el enlace de restablecimiento",
      },
      resetPassword: {
        title: "Restablecer la contraseña",
        description: "Introduce tu contraseña nueva",
        passwordsDoNotMatch: "Las contraseñas no coinciden",
        missingResetToken:
          "Falta el token de restablecimiento. Usa el enlace que recibiste por correo.",
        couldNotResetPassword: "No se ha podido restablecer la contraseña",
        somethingWentWrong: "Algo ha salido mal. Inténtalo de nuevo.",
        newPasswordLabel: "Contraseña nueva",
        confirmPasswordLabel: "Confirma la contraseña",
        submit: "Restablecer la contraseña",
        backToSignIn: "Volver al inicio de sesión",
      },
      verifyEmail: {
        title: "Verifica tu correo",
        description: "Hemos enviado un código de 6 dígitos a {email}",
        invalidVerificationCode: "Código de verificación no válido",
        somethingWentWrong: "Algo ha salido mal. Inténtalo de nuevo.",
        resendFailed: "No se ha podido reenviar el código. Inténtalo de nuevo.",
        resent: "Se ha enviado un código nuevo a tu correo.",
        submit: "Verificar el correo",
        resendCode: "Reenviar el código",
        sending: "Enviando...",
      },
      acceptInvite: {
        signInAfterRedeemFailed: "El inicio de sesión tras aceptar la invitación ha fallado",
        couldNotAcceptInvitation: "No se ha podido aceptar la invitación",
        invitationUnavailableTitle: "Invitación no disponible",
        invitationAlreadyUsed: "Esta invitación ya se ha utilizado.",
        invitationExpired: "Esta invitación ha caducado. Pide una nueva a un administrador.",
        invitationInvalid: "Este enlace de invitación no es válido.",
        title: "Acepta tu invitación",
        description:
          "Te han invitado a unirte como {email}. Indica tu nombre y una contraseña para terminar de crear tu cuenta.",
        fullNameLabel: "Nombre completo",
        passwordLabel: "Contraseña",
        submit: "Aceptar la invitación",
      },
    },
  },
} satisfies LocaleMessageDefinitions<{ auth: AdminAuthMessages }>
