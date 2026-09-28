import "server-only";

import { Resend } from "resend";

/**
 * Sending email as EDOS CRM.
 *
 * Every message this product sends now comes from here — the auth mail that
 * arrives before anyone has an account, the invitation to join a workspace,
 * the acknowledgement to a complainant, and the staff notifications. One
 * module, one sender, one shell, so somebody who has seen one of our emails
 * recognises the next. That recognition is most of what stops a genuine
 * message being mistaken for a forgery.
 *
 * Supabase can send auth email itself, and it used to. Its stock template is
 * a bare line of text and a naked link from whatever address the whole
 * project is configured with — the exact shape of a phishing attempt, and
 * mail providers score it accordingly. A person's very first message from us
 * is the worst possible one to land in Spam.
 *
 * This replaces the previous hand-rolled fetch wrapper (lib/notify/email.ts).
 * The SDK is used rather than a raw POST for one reason worth the dependency:
 * it carries the plain-text part properly, and a message without one both
 * scores worse with filters and renders as nothing in a text-only client.
 */

export type EmailResult = { sent: true } | { sent: false; reason: string };

export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  /**
   * Optional only because the operational notifications predate it. Auth and
   * complainant mail always passes one.
   */
  text?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "Email is not configured — set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `EDOS CRM <${from}>`,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (cause) {
    return {
      sent: false,
      reason: cause instanceof Error ? cause.message : "Could not send the email.",
    };
  }
}

/** The shell every EDOS CRM email shares. */
function shell({
  heading,
  body,
  cta,
  link,
}: {
  heading: string;
  body: string;
  cta: string;
  link: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12141c;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e5ec;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.04em;color:#1d3557;">EDOS CRM</p>
          <h1 style="margin:12px 0 0;font-size:20px;line-height:1.3;color:#12141c;">${heading}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px 0;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${body}</p>
          <p style="margin:0 0 20px;">
            <a href="${link}" style="display:inline-block;background:#1d3557;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">${cta}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#545b6b;">
            If the button doesn&rsquo;t work, copy this address into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#545b6b;">${link}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;border-top:1px solid #e2e5ec;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#545b6b;">
            EDOS CRM by EDOS Centre &middot; complaint management and customer care
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Confirming a new account. */
export function signupConfirmEmail({ link, name }: { link: string; name?: string | null }) {
  const greeting = name ? `${name}, welcome` : "Welcome";
  return {
    subject: "Confirm your EDOS CRM account",
    html: shell({
      heading: `${greeting} to EDOS CRM`,
      body: "Confirm this address and your workspace opens ready for its first complaint.",
      cta: "Confirm my account",
      link,
    }),
    text: [
      `${greeting} to EDOS CRM.`,
      "",
      "Confirm this address to finish setting up your account:",
      link,
      "",
      "The link can be used once and expires shortly.",
      "",
      "If you didn't sign up, ignore this email — no account will be activated.",
      "",
      "EDOS CRM",
    ].join("\n"),
  };
}

/** Inviting somebody into an existing workspace. */
export function teamInviteEmail({
  link,
  workspaceName,
  invitedBy,
}: {
  link: string;
  workspaceName: string;
  invitedBy?: string | null;
}) {
  const who = invitedBy ? `${invitedBy} has invited you` : "You have been invited";
  return {
    subject: `You've been invited to ${workspaceName} on EDOS CRM`,
    html: shell({
      heading: `Join ${workspaceName}`,
      body: `${who} to help handle complaints for <strong>${workspaceName}</strong> on EDOS CRM. Accept the invitation and choose a password to get started.`,
      cta: "Accept invitation",
      link,
    }),
    text: [
      `${who} to help handle complaints for ${workspaceName} on EDOS CRM.`,
      "",
      "Accept the invitation and choose a password here:",
      link,
      "",
      "If you weren't expecting this, you can ignore this email.",
      "",
      "EDOS CRM",
    ].join("\n"),
  };
}

/**
 * The reset email.
 *
 * Deliberately plain, and deliberately specific: it names the product, says
 * what was asked for, and says what to do if it wasn't you. Those are the
 * three things the stock template left out and the three things that make an
 * email read as genuine.
 */
export function passwordResetEmail({ link }: { link: string }) {
  return {
    subject: "Reset your EDOS CRM password",
    html: shell({
      heading: "Reset your password",
      body: "Someone asked to reset the password for your EDOS CRM account. Choose a new one here. The link can be used once and expires shortly — if this wasn&rsquo;t you, ignore this email and your password stays as it is.",
      cta: "Set a new password",
      link,
    }),
    text: [
      "Someone asked to reset the password for your EDOS CRM account.",
      "",
      "Open this link to choose a new password:",
      link,
      "",
      "The link can be used once and expires shortly.",
      "",
      "If this wasn't you, ignore this email — your password has not changed.",
      "",
      "EDOS CRM",
    ].join("\n"),
  };
}
