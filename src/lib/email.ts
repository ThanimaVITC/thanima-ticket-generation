import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

/**
 * Get or create a reusable Nodemailer transporter.
 *
 * Pooling is a win on a long-lived server, where the same process sends thousands of
 * mails and reuses the sockets. It is not a win on Vercel: every invocation is a fresh
 * container, so the pool is never reused across requests, and open pooled sockets can
 * hold the function alive until the duration limit. So pooling is off when
 * HOSTING_VERCEL is set and on everywhere else.
 */
export function createTransporter(): Transporter {
    if (cachedTransporter) return cachedTransporter;

    const onVercel = process.env.HOSTING_VERCEL?.toLowerCase() === 'true';

    cachedTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        ...(onVercel
            ? {}
            : {
                  pool: true,
                  maxConnections: 5,
                  maxMessages: 100,
              }),
    });

    return cachedTransporter;
}

/**
 * Send a ticket email with the ticket PNG as both an inline image and a downloadable attachment.
 */
export async function sendTicketEmail({
    to,
    subject,
    html,
    ticketBuffer,
    studentName,
}: {
    to: string;
    subject: string;
    html: string;
    ticketBuffer: Buffer;
    studentName: string;
}) {
    const transport = createTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transport.sendMail({
        from,
        to,
        subject,
        html,
        attachments: [
            {
                filename: `ticket_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                content: ticketBuffer,
                contentType: 'image/png',
                cid: 'ticket-image',
            },
        ],
    });
}

// Public website URL event admins log in to.
const WEBSITE_URL = 'https://ticketing.thanimavitc.site';

/**
 * Send a plain-text account-credentials email to a newly invited user.
 * - event_admin: website URL + login email (username) + password.
 * - app_user: login email + password (they use the mobile app, not the website).
 */
export async function sendAccountCredentialsEmail({
    to,
    name,
    role,
    password,
}: {
    to: string;
    name: string;
    role: 'event_admin' | 'app_user';
    password: string;
}) {
    const transport = createTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const subject =
        role === 'event_admin'
            ? 'Your Thanima Ticketing event admin account'
            : 'Your Thanima Ticketing app account';

    const text =
        role === 'event_admin'
            ? `Hello ${name},

You have been added as an event admin for Thanima Ticketing.

Website: ${WEBSITE_URL}
Username: ${to}
Password: ${password}

Please log in and change your password if needed.`
            : `Hello ${name},

You have been added as an app user for Thanima Ticketing.

Email: ${to}
Password: ${password}

Please log in to the app with the above credentials.`;

    await transport.sendMail({ from, to, subject, text });
}

/**
 * Replace template placeholders with actual values.
 */
export function renderEmailTemplate(
    template: string,
    variables: Record<string, string>
): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Build the default HTML email body wrapping the template text + inline ticket image.
 */
export function buildEmailHtml(bodyText: string, variables: Record<string, string>): string {
    const renderedBody = renderEmailTemplate(bodyText, variables);
    const paragraphs = renderedBody
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<p style="margin: 0 0 16px 0; color: #333333; line-height: 1.6; font-size: 15px;">${line}</p>`)
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="padding: 32px; border-bottom: 1px solid #eeeeee; text-align: center; background-color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #111111; letter-spacing: -0.5px;">Your Event Ticket</h2>
        </div>
        <div style="padding: 32px;">
            ${paragraphs || '<p style="margin: 0 0 16px 0; color: #333333; line-height: 1.6; font-size: 15px;">Please find your enclosed ticket below.</p>'}
            
            <div style="margin: 32px 0 0 0; text-align: center;">
                <img src="cid:ticket-image" alt="Your Ticket" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
            </div>
            
            <p style="margin: 32px 0 0 0; color : #888888; font-size: 13px; line-height: 1.5; text-align: center; padding-top: 24px; border-top: 1px solid #eeeeee;">
                Please keep this ticket secure. You will need to present the QR code at the event for verification.
            </p>
        </div>
    </div>
</body>
</html>`.trim();
}

/**
 * Verify the SMTP connection is working.
 */
export async function verifyTransporter(): Promise<boolean> {
    try {
        const transport = createTransporter();
        await transport.verify();
        return true;
    } catch {
        return false;
    }
}

export const DEFAULT_FOOD_EMAIL_SUBJECT = 'You are checked in for {{eventTitle}}';
export const DEFAULT_FOOD_EMAIL_BODY =
    'Hi {{name}},\n\nYou are checked in for {{eventTitle}}. Your food colour is below — show your ticket QR at that counter to be served.';

/**
 * The "you're checked in, here's your food colour" email.
 *
 * Two things drive the markup:
 *
 * 1. The colour is never the only carrier of the message. Roughly 8% of men have a
 *    colour vision deficiency, and this palette contains both red/green and the
 *    near-pairs red/pink and purple/pink. So the colour NAME is set large next to
 *    the swatch — someone who cannot tell the swatch apart can still read "RED".
 * 2. Outlook ignores CSS backgrounds on divs and strips <style> blocks, so the
 *    swatch is a table cell carrying both the `bgcolor` attribute and an inline
 *    style. Belt and braces is the only thing that renders everywhere.
 */
export function buildFoodColorEmailHtml({
    bodyText,
    variables,
    colorName,
    colorHex,
    timing,
}: {
    bodyText: string;
    variables: Record<string, string>;
    colorName: string;
    colorHex: string;
    timing?: string;
}): string {
    const renderedBody = renderEmailTemplate(bodyText, variables);
    const paragraphs = renderedBody
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<p style="margin: 0 0 16px 0; color: #333333; line-height: 1.6; font-size: 15px;">${escapeHtml(line)}</p>`)
        .join('');

    const timingRow = timing
        ? `<p style="margin: 16px 0 0 0; color: #111111; font-size: 16px; text-align: center;">
               Your sitting is at <strong>${escapeHtml(timing)}</strong>
           </p>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="padding: 32px; border-bottom: 1px solid #eeeeee; text-align: center;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #111111; letter-spacing: -0.5px;">You're checked in</h2>
        </div>
        <div style="padding: 32px;">
            ${paragraphs}

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0 0 0;">
                <tr>
                    <td bgcolor="${colorHex}" align="center"
                        style="background-color: ${colorHex}; border-radius: 8px; padding: 28px 16px;">
                        <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: ${onColor(colorHex)}; opacity: 0.85;">
                            Your food colour
                        </div>
                        <div style="font-size: 38px; font-weight: 700; letter-spacing: 1px; color: ${onColor(colorHex)}; padding-top: 4px;">
                            ${escapeHtml(colorName.toUpperCase())}
                        </div>
                    </td>
                </tr>
            </table>

            ${timingRow}

            <p style="margin: 24px 0 0 0; color: #333333; font-size: 15px; line-height: 1.6; text-align: center;">
                Go to the <strong>${escapeHtml(colorName)}</strong> counter and show your ticket QR code to be served.
            </p>

            <p style="margin: 32px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5; text-align: center; padding-top: 24px; border-top: 1px solid #eeeeee;">
                One serving per person. Bring the same ticket you checked in with.
            </p>
        </div>
    </div>
</body>
</html>`.trim();
}

/** Dark text on a light swatch, white on a dark one, so the colour name stays legible. */
function onColor(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

/** Template text is admin-authored, but it still must not break the surrounding markup. */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Plain email, no attachment — used by the food colour send. */
export async function sendPlainEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    const transport = createTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transport.sendMail({ from, to, subject, html });
}
