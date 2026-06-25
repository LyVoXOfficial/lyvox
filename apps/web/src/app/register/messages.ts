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
  socialGoogle: string;
  socialFacebook: string;
  dividerLabel: string;
  checkingEmail: string;
  emailAvailable: string;
  loginPrompt: string;
  loginLink: string;
};

const englishMessages: RegisterMessages = {
  title: "Create your LyVoX account",
  intro: "Register once to post listings, message sellers, save searches, and manage trusted account checks.",
  languageLabel: "Language",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  emailError: "Enter a valid email address, for example user@example.com.",
  passwordLabel: "Password",
  passwordHint: "Use at least 8 characters and mix uppercase, lowercase, numbers, and symbols.",
  passwordChecklist: [
    "Minimum 8 characters",
    "Uppercase and lowercase letters",
    "At least one number",
    "Special character, for example ! ? &",
  ],
  passwordError: "Password must contain at least 8 characters and 3 of: uppercase, lowercase, numbers, symbols.",
  confirmPasswordLabel: "Confirm password",
  confirmPasswordError: "Passwords do not match. Enter the same password in both fields.",
  consentsTitle: "Required consents",
  consentsError: "Accept the Terms of Service and Privacy Policy to continue.",
  legalLinkLabel: "View",
  consents: {
    terms: "I accept the Terms of Service",
    privacy: "I have read the Privacy Notice",
    marketing: "Send me marketplace updates (optional)",
  },
  submit: "Create account",
  successTitle: "Check your inbox",
  successBody: "We sent a confirmation email. Follow the link to verify your address and continue onboarding.",
  errorGeneric: "Registration failed. Check your information and try again.",
  errorEmailInUse: "This email is already registered. Try signing in or use a different email.",
  errorWeakPassword: "Password is too weak. Use uppercase and lowercase letters, numbers, and symbols.",
  errorService: "Registration is temporarily unavailable. Try again later or contact support.",
  socialGoogle: "Continue with Google",
  socialFacebook: "Continue with Facebook",
  dividerLabel: "or use email",
  checkingEmail: "Checking...",
  emailAvailable: "Available",
  loginPrompt: "Already have an account?",
  loginLink: "Sign in",
};

export const registerMessages: Record<Locale, RegisterMessages> = {
  en: englishMessages,
  fr: {
    title: "Creer votre compte LyVoX",
    intro: "Inscrivez-vous pour publier des annonces, contacter les vendeurs et gerer les verifications du compte.",
    languageLabel: "Langue",
    emailLabel: "Email",
    emailPlaceholder: "vous@example.com",
    emailError: "Entrez une adresse email valide, par exemple user@example.com.",
    passwordLabel: "Mot de passe",
    passwordHint: "Utilisez au moins 8 caracteres avec majuscules, minuscules, chiffres et symboles.",
    passwordChecklist: [
      "Minimum 8 caracteres",
      "Lettres majuscules et minuscules",
      "Au moins un chiffre",
      "Caractere special, par exemple ! ? &",
    ],
    passwordError: "Le mot de passe doit contenir 8 caracteres et 3 types de caracteres.",
    confirmPasswordLabel: "Confirmer le mot de passe",
    confirmPasswordError: "Les mots de passe ne correspondent pas.",
    consentsTitle: "Consentements requis",
    consentsError: "Acceptez les Conditions et la Politique de confidentialite pour continuer.",
    legalLinkLabel: "Voir",
    consents: {
      terms: "J'accepte les Conditions d'utilisation",
      privacy: "J'ai lu la Politique de confidentialite",
      marketing: "M'envoyer les actualites de la marketplace (optionnel)",
    },
    submit: "Creer le compte",
    successTitle: "Verifiez votre boite email",
    successBody: "Nous avons envoye un email de confirmation. Suivez le lien pour continuer.",
    errorGeneric: "Inscription impossible. Verifiez les informations et reessayez.",
    errorEmailInUse: "Cet email est deja enregistre. Connectez-vous ou utilisez un autre email.",
    errorWeakPassword: "Le mot de passe est trop faible.",
    errorService: "Inscription temporairement indisponible.",
    socialGoogle: "Continuer avec Google",
    socialFacebook: "Continuer avec Facebook",
    dividerLabel: "ou utiliser l'email",
    checkingEmail: "Verification...",
    emailAvailable: "Disponible",
    loginPrompt: "Vous avez deja un compte ?",
    loginLink: "Se connecter",
  },
  nl: {
    title: "Maak je LyVoX-account",
    intro: "Registreer om advertenties te plaatsen, verkopers te berichten en accountcontroles te beheren.",
    languageLabel: "Taal",
    emailLabel: "Email",
    emailPlaceholder: "jij@example.com",
    emailError: "Voer een geldig emailadres in, bijvoorbeeld user@example.com.",
    passwordLabel: "Wachtwoord",
    passwordHint: "Gebruik minstens 8 tekens met hoofdletters, kleine letters, cijfers en symbolen.",
    passwordChecklist: [
      "Minimaal 8 tekens",
      "Hoofdletters en kleine letters",
      "Ten minste een cijfer",
      "Speciaal teken, bijvoorbeeld ! ? &",
    ],
    passwordError: "Het wachtwoord moet 8 tekens en 3 tekentypes bevatten.",
    confirmPasswordLabel: "Bevestig wachtwoord",
    confirmPasswordError: "Wachtwoorden komen niet overeen.",
    consentsTitle: "Vereiste toestemmingen",
    consentsError: "Accepteer de voorwaarden en privacyverklaring om verder te gaan.",
    legalLinkLabel: "Bekijken",
    consents: {
      terms: "Ik ga akkoord met de Servicevoorwaarden",
      privacy: "Ik heb de Privacyverklaring gelezen",
      marketing: "Stuur mij marketplace-updates (optioneel)",
    },
    submit: "Account maken",
    successTitle: "Controleer je inbox",
    successBody: "We hebben een bevestigingsmail gestuurd. Volg de link om verder te gaan.",
    errorGeneric: "Registratie mislukt. Controleer je gegevens en probeer opnieuw.",
    errorEmailInUse: "Dit emailadres is al geregistreerd. Log in of gebruik een ander emailadres.",
    errorWeakPassword: "Het wachtwoord is te zwak.",
    errorService: "Registratie is tijdelijk niet beschikbaar.",
    socialGoogle: "Doorgaan met Google",
    socialFacebook: "Doorgaan met Facebook",
    dividerLabel: "of gebruik email",
    checkingEmail: "Controleren...",
    emailAvailable: "Beschikbaar",
    loginPrompt: "Heb je al een account?",
    loginLink: "Inloggen",
  },
  ru: {
    title: "Создайте аккаунт LyVoX",
    intro: "Зарегистрируйтесь один раз, чтобы публиковать объявления, писать продавцам, сохранять поиски и проходить проверки доверия.",
    languageLabel: "Язык",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    emailError: "Введите корректный email, например user@example.com.",
    passwordLabel: "Пароль",
    passwordHint: "Используйте не менее 8 символов и сочетайте заглавные, строчные буквы, цифры и символы.",
    passwordChecklist: [
      "Минимум 8 символов",
      "Заглавные и строчные буквы",
      "Хотя бы одна цифра",
      "Специальный символ, например ! ? &",
    ],
    passwordError: "Пароль должен содержать не менее 8 символов и 3 из: заглавные, строчные, цифры, символы.",
    confirmPasswordLabel: "Подтвердите пароль",
    confirmPasswordError: "Пароли не совпадают. Введите одинаковый пароль в обоих полях.",
    consentsTitle: "Обязательные согласия",
    consentsError: "Примите Условия использования и Политику конфиденциальности, чтобы продолжить.",
    legalLinkLabel: "Посмотреть",
    consents: {
      terms: "Я принимаю Условия использования",
      privacy: "Я ознакомился с Политикой конфиденциальности",
      marketing: "Присылать новости маркетплейса (необязательно)",
    },
    submit: "Создать аккаунт",
    successTitle: "Проверьте почту",
    successBody: "Мы отправили письмо для подтверждения. Перейдите по ссылке, чтобы подтвердить адрес и продолжить регистрацию.",
    errorGeneric: "Не удалось зарегистрироваться. Проверьте данные и попробуйте снова.",
    errorEmailInUse: "Этот email уже зарегистрирован. Войдите или используйте другой адрес.",
    errorWeakPassword: "Пароль слишком простой. Используйте заглавные и строчные буквы, цифры и символы.",
    errorService: "Регистрация временно недоступна. Попробуйте позже или обратитесь в поддержку.",
    socialGoogle: "Продолжить с Google",
    socialFacebook: "Продолжить с Facebook",
    dividerLabel: "или по email",
    checkingEmail: "Проверка...",
    emailAvailable: "Доступен",
    loginPrompt: "Уже есть аккаунт?",
    loginLink: "Войти",
  },
  de: {
    title: "LyVoX-Konto erstellen",
    intro: "Registrieren Sie sich, um Anzeigen zu posten, Nachrichten zu senden und Kontopruefungen zu verwalten.",
    languageLabel: "Sprache",
    emailLabel: "Email",
    emailPlaceholder: "sie@example.com",
    emailError: "Geben Sie eine gueltige Email-Adresse ein, zum Beispiel user@example.com.",
    passwordLabel: "Passwort",
    passwordHint: "Nutzen Sie mindestens 8 Zeichen mit Gross- und Kleinbuchstaben, Zahlen und Symbolen.",
    passwordChecklist: [
      "Mindestens 8 Zeichen",
      "Gross- und Kleinbuchstaben",
      "Mindestens eine Zahl",
      "Sonderzeichen, zum Beispiel ! ? &",
    ],
    passwordError: "Das Passwort muss 8 Zeichen und 3 Zeichentypen enthalten.",
    confirmPasswordLabel: "Passwort bestaetigen",
    confirmPasswordError: "Passwoerter stimmen nicht ueberein.",
    consentsTitle: "Erforderliche Zustimmungen",
    consentsError: "Akzeptieren Sie die Bedingungen und Datenschutzhinweise, um fortzufahren.",
    legalLinkLabel: "Ansehen",
    consents: {
      terms: "Ich akzeptiere die Nutzungsbedingungen",
      privacy: "Ich habe die Datenschutzhinweise gelesen",
      marketing: "Senden Sie mir Marketplace-Updates (optional)",
    },
    submit: "Konto erstellen",
    successTitle: "Postfach pruefen",
    successBody: "Wir haben eine Bestaetigungs-E-Mail gesendet. Folgen Sie dem Link, um fortzufahren.",
    errorGeneric: "Registrierung fehlgeschlagen. Pruefen Sie die Angaben und versuchen Sie es erneut.",
    errorEmailInUse: "Diese Email ist bereits registriert. Melden Sie sich an oder nutzen Sie eine andere Email.",
    errorWeakPassword: "Das Passwort ist zu schwach.",
    errorService: "Registrierung ist voruebergehend nicht verfuegbar.",
    socialGoogle: "Weiter mit Google",
    socialFacebook: "Weiter mit Facebook",
    dividerLabel: "oder Email nutzen",
    checkingEmail: "Pruefen...",
    emailAvailable: "Verfuegbar",
    loginPrompt: "Sie haben bereits ein Konto?",
    loginLink: "Anmelden",
  },
};

export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Francais",
  nl: "Nederlands",
  ru: "Russian",
  de: "Deutsch",
};
