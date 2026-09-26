import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES } from "@/lib/data/tables";

/**
 * Email-to-case intake (brief §6 "Should": a controlled email-to-case process
 * for consumercare@ and related inboxes).
 *
 * Deliberately *controlled*, which is the word the brief uses: a message lands
 * in a holding list and a person turns it into a case. Auto-creating a
 * complaint from every inbound message would fill the register with
 * auto-replies, newsletters and bounce notifications, and each one would get a
 * case number and an acknowledgement email — noise that a quality system
 * cannot afford, since batch patterns are counted off these records.
 *
 * Provider-agnostic: it accepts the common shape that Resend, Postmark,
 * SendGrid and Mailgun inbound webhooks all reduce to. Authorised by a shared
 * secret, since the sender is a machine with no session.
 */
export const maxDuration = 30;

type Payload = {
  workspace?: string;
  to?: string;
  from?: string;
  from_name?: string;
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
};

/** "Jane Doe <jane@example.com>" -> jane@example.com */
function addressOf(value: string | undefined): string | null {
  if (!value) return null;
  const angled = value.match(/<([^>]+)>/);
  const raw = (angled ? angled[1] : value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}

function nameOf(value: string | undefined, explicit: string | undefined): string | null {
  if (explicit?.trim()) return explicit.trim();
  if (!value) return null;
  const name = value.split("<")[0].trim().replace(/^"|"$/g, "");
  return name && !name.includes("@") ? name : null;
}

/** Strip HTML to something readable if no plain-text part was sent. */
function textFrom(body: Payload): string {
  if (body.text?.trim()) return body.text.trim();
  if (!body.html) return "";
  return body.html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Messages that should never become a complaint. */
function isAutomated(body: Payload): boolean {
  const subject = (body.subject ?? "").toLowerCase();
  const from = (addressOf(body.from) ?? "").toLowerCase();
  return (
    from.startsWith("mailer-daemon@") ||
    from.startsWith("postmaster@") ||
    from.startsWith("no-reply@") ||
    from.startsWith("noreply@") ||
    subject.startsWith("auto:") ||
    subject.startsWith("automatic reply") ||
    subject.startsWith("out of office") ||
    subject.includes("undeliverable") ||
    subject.includes("delivery status notification")
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Inbound email is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const fromEmail = addressOf(body.from);
  if (!fromEmail) {
    return NextResponse.json({ error: "A valid sender address is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Which workspace: an explicit slug, otherwise the recipient address is
  // matched against a workspace slug (consumercare@edoscrm... -> the local
  // part is not the workspace, so the slug has to be given explicitly unless
  // exactly one workspace exists).
  let tenantId: string | null = null;
  if (body.workspace) {
    const { data } = await admin.from(TABLES.tenants).select("id").eq("slug", body.workspace.trim().toLowerCase()).maybeSingle();
    tenantId = (data?.id as string) ?? null;
  } else {
    const { data } = await admin.from(TABLES.tenants).select("id").limit(2);
    if ((data ?? []).length === 1) tenantId = data![0].id as string;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Could not determine the workspace for this message." }, { status: 400 });
  }

  if (isAutomated(body)) {
    // Accepted and dropped: returning an error would make the provider retry
    // a message we will never want.
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const { error } = await admin.from(TABLES.inboundEmails).insert({
    tenant_id: tenantId,
    message_id: body.message_id ?? null,
    from_email: fromEmail,
    from_name: nameOf(body.from, body.from_name),
    subject: (body.subject ?? "").slice(0, 500) || "(no subject)",
    body: textFrom(body).slice(0, 20000),
    status: "received",
  });

  // A duplicate message_id means the provider retried a message we already
  // hold. That is a success from its point of view, not an error.
  if (error && !error.message.includes("duplicate key")) {
    return NextResponse.json({ error: "Could not accept that message." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "received" });
}
