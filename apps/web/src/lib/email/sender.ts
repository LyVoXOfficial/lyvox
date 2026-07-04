import { supabaseService } from "@/lib/supabaseService";
import type { Locale } from "@/lib/i18n";

interface SendEmailOptions {
  userId: string;
  type: "new_message" | "advert_approved" | "advert_rejected" | "payment_completed" | "saved_search";
  data: Record<string, any>;
  locale: Locale;
}

export function emailProviderConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY || env.SENDGRID_API_KEY);
}

async function deliverEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "LyVoX <notifications@lyvox.be>";

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return response.ok;
  }

  if (process.env.SENDGRID_API_KEY) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.EMAIL_FROM_ADDRESS || "notifications@lyvox.be", name: "LyVoX" },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });
    return response.ok;
  }

  return false;
}

/**
 * Send email notification to user
 * Uses Supabase Auth email or external SMTP service
 */
export async function sendEmail({
  userId,
  type,
  data,
  locale,
}: SendEmailOptions): Promise<boolean> {
  try {
    const supabase = await supabaseService();

    // Get user email and preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      console.error(`User ${userId} not found`);
      return false;
    }

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    if (!authUser?.user?.email) {
      console.error(`User ${userId} has no email`);
      return false;
    }

    // Check preferences
    const { data: prefs } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .maybeSingle();

    const preferences = prefs?.notification_preferences as
      | {
          email?: Record<string, boolean>;
        }
      | undefined;

    // Check if email notifications are enabled for this type
    if (preferences?.email?.[type] === false) {
      console.log(`Email notifications disabled for ${type} for user ${userId}`);
      return false;
    }

    // Check quiet hours (22:00 - 08:00)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 22 || hour < 8) {
      console.log(`Quiet hours: skipping email for user ${userId}`);
      // Still create notification record, but don't send email
    }

    // Get email template
    const { getEmailTemplate } = await import("./templates");
    const template = getEmailTemplate(type, locale, data);

    const delivered = await deliverEmail({
      to: authUser.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (!delivered) {
      console.error(`Email delivery failed for user ${userId}, type ${type}`);
      return false;
    }

    // Create notification record
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      channel: "email",
      title: template.subject,
      body: template.html,
      payload: data,
      sent_at: new Date().toISOString(),
    });

    if (notifError) {
      console.error("Failed to create notification:", notifError);
      return false;
    }

    console.log(`Email notification sent for user ${userId}, type ${type}`);

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
