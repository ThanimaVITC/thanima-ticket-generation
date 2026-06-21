import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

/**
 * Get or create a reusable Nodemailer transporter.
 * This caches the transporter to avoid SMTP overhead on every email and uses pooling for bulk emails.
 */
export function createTransporter(): Transporter {
    if (cachedTransporter) return cachedTransporter;

    cachedTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        pool: true, // Use SMTP connection pooling
        maxConnections: 5, // Maximum simultaneous connections
        maxMessages: 100, // Messages per connection before recycling
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
