import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Create or return a cached Nodemailer transporter in pool mode.
 */
export function createTransporter(): Transporter {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
    });

    return transporter;
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
        .map(line => `<p style="margin: 0 0 12px 0; color: #333;">${line}</p>`)
        .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #7c3aed; margin: 0 0 20px 0;">Your Event Ticket</h2>
        ${paragraphs || '<p style="color: #333;">Please find your ticket attached below.</p>'}
        <div style="margin: 24px 0; text-align: center;">
            <img src="cid:ticket-image" alt="Your Ticket" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
            Please keep this ticket safe. You will need to present the QR code at the event for verification.
        </p>
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
