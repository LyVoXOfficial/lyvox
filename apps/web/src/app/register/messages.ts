import type { Locale } from "@/lib/i18n";

type ConsentKeys = "terms" | "privacy" | "marketing";

type RegisterMessages = {
  title: string;
  intro: string;
  languageLabel: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailError: string;
  passwordLabel: string;
  passwordHint: string;
  passwordChecklist: string[];
  passwordError: string;
  confirmPasswordLabel: string;
  confirmPasswordError: string;
  consentsTitle: string;
  consentsError: string;
  legalLinkLabel: string;
  consents: Record<ConsentKeys, string>;
  submit: string;
  successTitle: string;
  successBody: string;
  errorGeneric: string;
  errorEmailInUse: string;
  errorWeakPassword: string;
  errorService: string;
};

export const registerMessages: Record<Locale, RegisterMessages> = {
  en: {
    title: "Create your LyVoX account",
    intro: "Enter your details to register. We will email you a confirmation link to start onboarding.",
    languageLabel: "Language",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    emailError: "Please enter a valid email address (e.g., user@example.com)",
    passwordLabel: "Password",
    passwordHint: "Use at least 8 characters and mix uppercase, lowercase, numbers, and symbols.",
    passwordChecklist: [
      "Minimum 8 characters",
      "Letters in upper and lower case",
      "At least one number",
      "Special character (e.g. ! ? &)",
    ],
    passwordError: "Password must contain at least 8 characters and 3 of: uppercase, lowercase, numbers, symbols",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordError: "Passwords don't match. Please enter the same password in both fields",
    consentsTitle: "Required consents",
    consentsError: "You must accept the Terms of Service and Privacy Policy to continue",
    legalLinkLabel: "View",
    consents: {
      terms: "I accept the Terms of Service",
      privacy: "I have read the Privacy Notice",
      marketing: "Send me marketplace updates (optional)",
    },
    submit: "Register",
    successTitle: "Check your inbox",
    successBody: "We sent a confirmation email. Follow the link to verify your address and continue onboarding.",
    errorGeneric: "Registration failed. Please check your information and try again",
    errorEmailInUse: "This email is already registered. Try logging in or use a different email",
    errorWeakPassword: "Password is too weak. Use uppercase and lowercase letters, numbers, and symbols",
    errorService: "Registration is temporarily unavailable. Please try again later or contact support",
  },
  fr: {
    title: "Creez votre compte LyVoX",
    intro: "Entrez vos informations pour vous inscrire. Un e-mail de confirmation vous sera envoye pour demarrer l'onboarding.",
    languageLabel: "Langue",
    emailLabel: "E-mail",
    emailPlaceholder: "vous@example.com",
    emailError: "Indiquez une adresse e-mail valide.",
    passwordLabel: "Mot de passe",
    passwordHint: "Utilisez au moins 8 caracteres avec majuscules, minuscules, chiffres et symboles.",
    passwordChecklist: [
      "Au minimum 8 caracteres",
      "Lettres en majuscule et minuscule",
      "Au moins un chiffre",
      "Caractere special (ex. ! ? &)",
    ],
    passwordError: "Le mot de passe ne respecte pas les regles de securite.",
    confirmPasswordLabel: "Confirmez le mot de passe",
    confirmPasswordError: "Les mots de passe ne correspondent pas.",
    consentsTitle: "Consentements requis",
    consentsError: "Acceptez les politiques obligatoires pour continuer.",
    legalLinkLabel: "Voir",
    consents: {
      terms: "J'accepte les Conditions d'utilisation",
      privacy: "J'ai lu la Politique de confidentialite",
      marketing: "Recevoir les actualites de la plateforme (optionnel)",
    },
    submit: "S'inscrire",
    successTitle: "Verifiez votre messagerie",
    successBody: "Un e-mail de confirmation a ete envoye. Suivez le lien pour verifier votre adresse et poursuivre l'onboarding.",
    errorGeneric: "L'inscription a echoue. Reessayez.",
    errorEmailInUse: "Un compte existe deja avec cet e-mail.",
    errorWeakPassword: "Le mot de passe ne respecte pas les exigences de securite.",
    errorService: "Inscription temporairement indisponible. Reessayez plus tard.",
  },
  nl: {
    title: "Maak je LyVoX-account",
    intro: "Vul je gegevens in om je te registreren. Je ontvangt een bevestigingsmail om de onboarding te starten.",
    languageLabel: "Taal",
    emailLabel: "E-mail",
    emailPlaceholder: "jij@example.com",
    emailError: "Voer een geldig e-mailadres in.",
    passwordLabel: "Wachtwoord",
    passwordHint: "Gebruik minstens 8 tekens met hoofdletters, kleine letters, cijfers en symbolen.",
    passwordChecklist: [
      "Minimaal 8 tekens",
      "Letters in hoofd- en kleine letters",
      "Ten minste een cijfer",
      "Speciaal teken (bijv. ! ? &)",
    ],
    passwordError: "Het wachtwoord voldoet niet aan de beveiligingsregels.",
    confirmPasswordLabel: "Bevestig wachtwoord",
    confirmPasswordError: "Wachtwoorden komen niet overeen.",
    consentsTitle: "Vereiste toestemmingen",
    consentsError: "Accepteer de verplichte voorwaarden om verder te gaan.",
    legalLinkLabel: "Bekijken",
    consents: {
      terms: "Ik ga akkoord met de Servicevoorwaarden",
      privacy: "Ik heb het Privacybeleid gelezen",
      marketing: "Stuur mij platformupdates (optioneel)",
    },
    submit: "Registreren",
    successTitle: "Controleer je inbox",
    successBody: "We hebben een bevestigingsmail gestuurd. Volg de link om je adres te verifiëren en door te gaan met onboarding.",
    errorGeneric: "Registratie mislukt. Probeer het opnieuw.",
    errorEmailInUse: "Er bestaat al een account met dit e-mailadres.",
    errorWeakPassword: "Het wachtwoord voldoet niet aan de beveiligingseisen.",
    errorService: "Registratie is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
  },
  ru: {
    title: "Создайте учетную запись LyVoX",
    intro: "Заполните форму для регистрации. Мы отправим письмо с подтверждением, чтобы запустить онбординг.",
    languageLabel: "Язык",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    emailError: "Введите корректный email адрес (например: user@example.com)",
    passwordLabel: "Пароль",
    passwordHint: "Используйте не менее 8 символов, сочетайте буквы разного регистра, цифры и спецсимволы.",
    passwordChecklist: [
      "Минимум 8 символов",
      "Буквы верхнего и нижнего регистра",
      "Хотя бы одна цифра",
      "Спецсимвол (например, ! ? &)",
    ],
    passwordError: "Пароль должен содержать минимум 8 символов и 3 из: заглавные буквы, строчные буквы, цифры, символы",
    confirmPasswordLabel: "Повторите пароль",
    confirmPasswordError: "Пароли не совпадают. Введите одинаковые пароли в оба поля",
    consentsTitle: "Обязательные согласия",
    consentsError: "Необходимо принять условия использования и политику конфиденциальности",
    legalLinkLabel: "Открыть",
    consents: {
      terms: "Я принимаю условия использования",
      privacy: "Я прочитал(а) уведомление о конфиденциальности",
      marketing: "Присылать новости маркетплейса (по желанию)",
    },
    submit: "Зарегистрироваться",
    successTitle: "Проверьте почту",
    successBody: "Мы отправили письмо с подтверждением. Перейдите по ссылке, чтобы подтвердить адрес и продолжить онбординг.",
    errorGeneric: "Не удалось завершить регистрацию. Проверьте введенные данные и попробуйте еще раз",
    errorEmailInUse: "Этот email уже зарегистрирован. Попробуйте войти или используйте другой email",
    errorWeakPassword: "Пароль слишком простой. Используйте заглавные и строчные буквы, цифры и символы",
    errorService: "Регистрация временно недоступна. Попробуйте позже или обратитесь в поддержку",
  },
  de: {
    title: "Erstellen Sie Ihr LyVoX-Konto",
    intro: "Geben Sie Ihre Daten ein, um sich zu registrieren. Wir senden Ihnen einen Bestätigungslink per E-Mail, um das Onboarding zu starten.",
    languageLabel: "Sprache",
    emailLabel: "E-Mail",
    emailPlaceholder: "sie@example.com",
    emailError: "Geben Sie eine gültige E-Mail-Adresse ein.",
    passwordLabel: "Passwort",
    passwordHint: "Verwenden Sie mindestens 8 Zeichen mit Groß-/Kleinbuchstaben, Zahlen und Symbolen.",
    passwordChecklist: [
      "Mindestens 8 Zeichen",
      "Groß- und Kleinbuchstaben",
      "Mindestens eine Zahl",
      "Sonderzeichen (z. B. ! ? &)",
    ],
    passwordError: "Das Passwort erfüllt nicht die Sicherheitsanforderungen.",
    confirmPasswordLabel: "Passwort bestätigen",
    confirmPasswordError: "Passwörter stimmen nicht überein.",
    consentsTitle: "Erforderliche Einwilligungen",
    consentsError: "Akzeptieren Sie die erforderlichen Richtlinien, um fortzufahren.",
    legalLinkLabel: "Ansehen",
    consents: {
      terms: "Ich akzeptiere die Nutzungsbedingungen",
      privacy: "Ich habe die Datenschutzhinweise gelesen",
      marketing: "Senden Sie mir Updates zum Marktplatz (optional)",
    },
    submit: "Registrieren",
    successTitle: "Bitte E-Mail-Postfach prüfen",
    successBody: "Wir haben eine Bestätigungs-E-Mail gesendet. Folgen Sie dem Link, um Ihre Adresse zu verifizieren und mit dem Onboarding fortzufahren.",
    errorGeneric: "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
    errorEmailInUse: "Ein Konto mit dieser E-Mail existiert bereits.",
    errorWeakPassword: "Das Passwort entspricht nicht den Sicherheitsanforderungen.",
    errorService: "Registrierung vorübergehend nicht verfügbar. Versuchen Sie es später erneut.",
  },
};

export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Francais",
  nl: "Nederlands",
  ru: "Русский",
  de: "Deutsch",
};
