import { run, query } from "./db";
import { generateId } from "./auth";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(import.meta.dir, "..");
const LOG_FILE = join(LOG_DIR, "emails.log");
const FROM_ADDRESS = "pawwatch-b14b09f4@ctomail.io";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

export interface EmailRecord {
  id: string;
  userId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string;
}

/**
 * Send an email. In production would use Resend/SMTP; for MVP,
 * logs to file + console and stores in the notification table.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  userId: string,
  type: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const logLine = `[${now}] TO: ${to} | SUBJECT: ${subject}\nBODY: ${body}\n---\n`;

  // Always log to console
  console.log(`📧 EMAIL SENT | To: ${to} | Subject: ${subject}`);

  // Always log to file
  try {
    appendFileSync(LOG_FILE, logLine);
  } catch (err) {
    console.error("Failed to write email log:", err);
  }

  // Always store in database
  try {
    const id = generateId();
    run(
      `INSERT INTO email_notifications (id, user_id, type, subject, body, recipient_email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id, userId, type, subject, body, to
    );
  } catch (err) {
    console.error("Failed to store email notification:", err);
  }

  // Try Resend API if key is available
  if (RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `PawWatch <${FROM_ADDRESS}>`,
          to: [to],
          subject,
          html: body,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Resend API error: ${response.status} ${errText}`);
        return false;
      }

      const data = await response.json();
      console.log(`📨 Resend email sent, ID: ${(data as any).id}`);
      return true;
    } catch (err) {
      console.error("Resend API call failed:", err);
      // Don't fail — logged email is still usable for MVP
    }
  }

  return true; // Logged successfully
}

/**
 * Get recent email notifications for a user
 */
export function getNotificationsForUser(userId: string, limit = 20): EmailRecord[] {
  try {
    const rows = query(
      `SELECT id, user_id, type, subject, body, sent_at
       FROM email_notifications
       WHERE user_id = ?
       ORDER BY sent_at DESC
       LIMIT ?`
    ).all(userId, limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      subject: r.subject,
      body: r.body,
      sentAt: r.sent_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Get count of unread notifications (all since we don't have read tracking yet)
 */
export function getNotificationCount(userId: string): number {
  try {
    const row = query(
      "SELECT COUNT(*) as c FROM email_notifications WHERE user_id = ?"
    ).get(userId) as { c: number } | null;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

// ── Template helpers ──

export function welcomeEmailBody(name: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">🐾</span>
        <h1 style="color: #b45309; margin: 8px 0;">Welcome to PawWatch!</h1>
      </div>
      <p style="color: #374151; font-size: 16px;">Hi ${name},</p>
      <p style="color: #374151; font-size: 16px;">
        Thanks for joining PawWatch — your trusted community for dog sitting.
        We're excited to have you on board!
      </p>
      <p style="color: #374151; font-size: 16px;">
        With PawWatch, you can book vetted sitters, track visits in real-time with GPS,
        and get complete care logs for every stay — all in one place.
      </p>
      <hr style="border: none; border-top: 1px solid #fde68a; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by PawWatch. You're receiving this because you signed up.
        Reply to: pawwatch-b14b09f4@ctomail.io
      </p>
    </div>
  `;
}

export function bookingConfirmationBody(
  ownerName: string,
  sitterName: string,
  dogName: string,
  date: string,
  startTime: string,
  endTime: string,
  address: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">🐾</span>
        <h1 style="color: #b45309; margin: 8px 0;">Booking Confirmed!</h1>
      </div>
      <p style="color: #374151; font-size: 16px;">Hi ${ownerName},</p>
      <p style="color: #374151; font-size: 16px;">
        Your booking has been confirmed! Here are the details:
      </p>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Sitter:</strong> ${sitterName}</p>
        <p style="margin: 4px 0;"><strong>Dog:</strong> ${dogName}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> ${startTime} – ${endTime}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${address}</p>
      </div>
      <p style="color: #374151; font-size: 14px;">
        You can track the sitter's arrival and view care logs in the app.
      </p>
      <hr style="border: none; border-top: 1px solid #fde68a; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by PawWatch. Reply to: pawwatch-b14b09f4@ctomail.io
      </p>
    </div>
  `;
}

export function sitterNotifyBody(
  sitterName: string,
  ownerName: string,
  dogName: string,
  date: string,
  startTime: string,
  endTime: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">🐾</span>
        <h1 style="color: #b45309; margin: 8px 0;">New Booking!</h1>
      </div>
      <p style="color: #374151; font-size: 16px;">Hi ${sitterName},</p>
      <p style="color: #374151; font-size: 16px;">
        You have a new booking from ${ownerName}!
      </p>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Owner:</strong> ${ownerName}</p>
        <p style="margin: 4px 0;"><strong>Dog:</strong> ${dogName}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> ${startTime} – ${endTime}</p>
      </div>
      <p style="color: #374151; font-size: 14px;">
        Check your dashboard for more details and to log care activities.
      </p>
      <hr style="border: none; border-top: 1px solid #fde68a; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by PawWatch. Reply to: pawwatch-b14b09f4@ctomail.io
      </p>
    </div>
  `;
}

export function careLogNotificationBody(
  ownerName: string,
  sitterName: string,
  dogName: string,
  summary: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">🐾</span>
        <h1 style="color: #b45309; margin: 8px 0;">Care Update!</h1>
      </div>
      <p style="color: #374151; font-size: 16px;">Hi ${ownerName},</p>
      <p style="color: #374151; font-size: 16px;">
        ${sitterName} just logged a care update for ${dogName}:
      </p>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0; font-size: 16px;">${summary}</p>
      </div>
      <p style="color: #374151; font-size: 14px;">
        View the full care log in the app for all the details.
      </p>
      <hr style="border: none; border-top: 1px solid #fde68a; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by PawWatch. Reply to: pawwatch-b14b09f4@ctomail.io
      </p>
    </div>
  `;
}

export function buildCareSummary(body: any): string {
  const parts: string[] = [];
  if (body.feeding) parts.push("🍽 Fed" + (body.feedingNotes ? ` — ${body.feedingNotes}` : ""));
  if (body.waterChanged) parts.push("💧 Water changed");
  if (body.treats) parts.push("🍖 Gave treats" + (body.treatNotes ? ` — ${body.treatNotes}` : ""));
  if (body.playtimeMinutes > 0) {
    parts.push(`🎾 ${body.playtimeMinutes} min playtime` + (body.playtimeNotes ? ` — ${body.playtimeNotes}` : ""));
  }
  return parts.length > 0 ? parts.join("<br>") : "General care check-in completed.";
}

export function videoNotificationBody(
  ownerName: string,
  sitterName: string,
  dogName: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">📹</span>
        <h1 style="color: #b45309; margin: 8px 0;">New Video Update!</h1>
      </div>
      <p style="color: #374151; font-size: 16px;">Hi ${ownerName},</p>
      <p style="color: #374151; font-size: 16px;">
        ${sitterName} sent you a video of ${dogName}!
      </p>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
        <p style="margin: 4px 0; font-size: 24px;">📹</p>
        <p style="margin: 4px 0; font-size: 16px; font-weight: 600;">${sitterName} shared a video update</p>
        <p style="margin: 4px 0; color: #6b7280;">Tap below to watch it in the app!</p>
      </div>
      <hr style="border: none; border-top: 1px solid #fde68a; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by PawWatch. Reply to: pawwatch-b14b09f4@ctomail.io
      </p>
    </div>
  `;
}
