import type { Locale } from "@/lib/i18n";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const templates: Record<
  string,
  Record<Locale, (data: Record<string, any>) => EmailTemplate>
> = {
  new_message: {
    en: (data) => ({
      subject: "New message on LyVoX",
      html: `
        <h2>New Message</h2>
        <p>You have received a new message from ${data.sender_name || "a user"}.</p>
        <p><a href="${data.conversation_url || "#"}">View conversation</a></p>
      `,
      text: `New message from ${data.sender_name || "a user"}. View conversation: ${data.conversation_url || "#"}`,
    }),
    ru: (data) => ({
      subject: "Новое сообщение на LyVoX",
      html: `
        <h2>Новое сообщение</h2>
        <p>Вы получили новое сообщение от ${data.sender_name || "пользователя"}.</p>
        <p><a href="${data.conversation_url || "#"}">Открыть диалог</a></p>
      `,
      text: `Новое сообщение от ${data.sender_name || "пользователя"}. Открыть диалог: ${data.conversation_url || "#"}`,
    }),
    nl: (data) => ({
      subject: "Nieuw bericht op LyVoX",
      html: `
        <h2>Nieuw Bericht</h2>
        <p>U heeft een nieuw bericht ontvangen van ${data.sender_name || "een gebruiker"}.</p>
        <p><a href="${data.conversation_url || "#"}">Bekijk gesprek</a></p>
      `,
      text: `Nieuw bericht van ${data.sender_name || "een gebruiker"}. Bekijk gesprek: ${data.conversation_url || "#"}`,
    }),
    fr: (data) => ({
      subject: "Nouveau message sur LyVoX",
      html: `
        <h2>Nouveau Message</h2>
        <p>Vous avez reçu un nouveau message de ${data.sender_name || "un utilisateur"}.</p>
        <p><a href="${data.conversation_url || "#"}">Voir la conversation</a></p>
      `,
      text: `Nouveau message de ${data.sender_name || "un utilisateur"}. Voir la conversation: ${data.conversation_url || "#"}`,
    }),
    de: (data) => ({
      subject: "Neue Nachricht auf LyVoX",
      html: `
        <h2>Neue Nachricht</h2>
        <p>Sie haben eine neue Nachricht von ${data.sender_name || "einem Benutzer"} erhalten.</p>
        <p><a href="${data.conversation_url || "#"}">Unterhaltung ansehen</a></p>
      `,
      text: `Neue Nachricht von ${data.sender_name || "einem Benutzer"}. Unterhaltung ansehen: ${data.conversation_url || "#"}`,
    }),
  },
  advert_approved: {
    en: (data) => ({
      subject: "Your advert has been approved",
      html: `
        <h2>Advert Approved</h2>
        <p>Your advert "${data.advert_title || ""}" has been approved and is now live.</p>
        <p><a href="${data.advert_url || "#"}">View advert</a></p>
      `,
      text: `Your advert "${data.advert_title || ""}" has been approved. View: ${data.advert_url || "#"}`,
    }),
    ru: (data) => ({
      subject: "Ваше объявление одобрено",
      html: `
        <h2>Объявление одобрено</h2>
        <p>Ваше объявление "${data.advert_title || ""}" было одобрено и теперь активно.</p>
        <p><a href="${data.advert_url || "#"}">Просмотреть объявление</a></p>
      `,
      text: `Ваше объявление "${data.advert_title || ""}" было одобрено. Просмотреть: ${data.advert_url || "#"}`,
    }),
    nl: (data) => ({
      subject: "Uw advertentie is goedgekeurd",
      html: `
        <h2>Advertentie Goedgekeurd</h2>
        <p>Uw advertentie "${data.advert_title || ""}" is goedgekeurd en is nu actief.</p>
        <p><a href="${data.advert_url || "#"}">Bekijk advertentie</a></p>
      `,
      text: `Uw advertentie "${data.advert_title || ""}" is goedgekeurd. Bekijk: ${data.advert_url || "#"}`,
    }),
    fr: (data) => ({
      subject: "Votre annonce a été approuvée",
      html: `
        <h2>Annonce Approuvée</h2>
        <p>Votre annonce "${data.advert_title || ""}" a été approuvée et est maintenant active.</p>
        <p><a href="${data.advert_url || "#"}">Voir l'annonce</a></p>
      `,
      text: `Votre annonce "${data.advert_title || ""}" a été approuvée. Voir: ${data.advert_url || "#"}`,
    }),
    de: (data) => ({
      subject: "Ihre Anzeige wurde genehmigt",
      html: `
        <h2>Anzeige Genehmigt</h2>
        <p>Ihre Anzeige "${data.advert_title || ""}" wurde genehmigt und ist jetzt aktiv.</p>
        <p><a href="${data.advert_url || "#"}">Anzeige ansehen</a></p>
      `,
      text: `Ihre Anzeige "${data.advert_title || ""}" wurde genehmigt. Ansehen: ${data.advert_url || "#"}`,
    }),
  },
  advert_rejected: {
    en: (data) => ({
      subject: "Your advert has been rejected",
      html: `
        <h2>Advert Rejected</h2>
        <p>Your advert "${data.advert_title || ""}" has been rejected.</p>
        ${data.reason ? `<p>Reason: ${data.reason}</p>` : ""}
      `,
      text: `Your advert "${data.advert_title || ""}" has been rejected.${data.reason ? ` Reason: ${data.reason}` : ""}`,
    }),
    ru: (data) => ({
      subject: "Ваше объявление отклонено",
      html: `
        <h2>Объявление отклонено</h2>
        <p>Ваше объявление "${data.advert_title || ""}" было отклонено.</p>
        ${data.reason ? `<p>Причина: ${data.reason}</p>` : ""}
      `,
      text: `Ваше объявление "${data.advert_title || ""}" было отклонено.${data.reason ? ` Причина: ${data.reason}` : ""}`,
    }),
    nl: (data) => ({
      subject: "Uw advertentie is afgewezen",
      html: `
        <h2>Advertentie Afgewezen</h2>
        <p>Uw advertentie "${data.advert_title || ""}" is afgewezen.</p>
        ${data.reason ? `<p>Reden: ${data.reason}</p>` : ""}
      `,
      text: `Uw advertentie "${data.advert_title || ""}" is afgewezen.${data.reason ? ` Reden: ${data.reason}` : ""}`,
    }),
    fr: (data) => ({
      subject: "Votre annonce a été rejetée",
      html: `
        <h2>Annonce Rejetée</h2>
        <p>Votre annonce "${data.advert_title || ""}" a été rejetée.</p>
        ${data.reason ? `<p>Raison: ${data.reason}</p>` : ""}
      `,
      text: `Votre annonce "${data.advert_title || ""}" a été rejetée.${data.reason ? ` Raison: ${data.reason}` : ""}`,
    }),
    de: (data) => ({
      subject: "Ihre Anzeige wurde abgelehnt",
      html: `
        <h2>Anzeige Abgelehnt</h2>
        <p>Ihre Anzeige "${data.advert_title || ""}" wurde abgelehnt.</p>
        ${data.reason ? `<p>Grund: ${data.reason}</p>` : ""}
      `,
      text: `Ihre Anzeige "${data.advert_title || ""}" wurde abgelehnt.${data.reason ? ` Grund: ${data.reason}` : ""}`,
    }),
  },
  payment_completed: {
    en: (data) => ({
      subject: "Payment completed",
      html: `
        <h2>Payment Completed</h2>
        <p>Your payment for "${data.product_name || ""}" has been completed successfully.</p>
        <p>Amount: ${data.amount || ""}</p>
      `,
      text: `Payment for "${data.product_name || ""}" completed. Amount: ${data.amount || ""}`,
    }),
    ru: (data) => ({
      subject: "Платеж завершен",
      html: `
        <h2>Платеж завершен</h2>
        <p>Ваш платеж за "${data.product_name || ""}" был успешно завершен.</p>
        <p>Сумма: ${data.amount || ""}</p>
      `,
      text: `Платеж за "${data.product_name || ""}" завершен. Сумма: ${data.amount || ""}`,
    }),
    nl: (data) => ({
      subject: "Betaling voltooid",
      html: `
        <h2>Betaling Voltooid</h2>
        <p>Uw betaling voor "${data.product_name || ""}" is succesvol voltooid.</p>
        <p>Bedrag: ${data.amount || ""}</p>
      `,
      text: `Betaling voor "${data.product_name || ""}" voltooid. Bedrag: ${data.amount || ""}`,
    }),
    fr: (data) => ({
      subject: "Paiement terminé",
      html: `
        <h2>Paiement Terminé</h2>
        <p>Votre paiement pour "${data.product_name || ""}" a été terminé avec succès.</p>
        <p>Montant: ${data.amount || ""}</p>
      `,
      text: `Paiement pour "${data.product_name || ""}" terminé. Montant: ${data.amount || ""}`,
    }),
    de: (data) => ({
      subject: "Zahlung abgeschlossen",
      html: `
        <h2>Zahlung Abgeschlossen</h2>
        <p>Ihre Zahlung für "${data.product_name || ""}" wurde erfolgreich abgeschlossen.</p>
        <p>Betrag: ${data.amount || ""}</p>
      `,
      text: `Zahlung für "${data.product_name || ""}" abgeschlossen. Betrag: ${data.amount || ""}`,
    }),
  },
};

export function getEmailTemplate(
  type: string,
  locale: Locale,
  data: Record<string, any>,
): EmailTemplate {
  const localeTemplates = templates[type];
  if (!localeTemplates) {
    throw new Error(`Email template not found for type: ${type}`);
  }

  const template = localeTemplates[locale] || localeTemplates.en;
  return template(data);
}

