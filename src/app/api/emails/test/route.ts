import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/middleware';
import { createTransporter, verifyTransporter } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { to } = body;

        if (!to || typeof to !== 'string') {
            return NextResponse.json({ error: 'A valid "to" email address is required' }, { status: 400 });
        }

        // Verify SMTP connection first
        const isConnected = await verifyTransporter();
        if (!isConnected) {
            return NextResponse.json(
                { error: 'SMTP connection failed. Please check your SMTP configuration in environment variables.' },
                { status: 503 }
            );
        }

        const transport = createTransporter();
        const from = process.env.SMTP_FROM || process.env.SMTP_USER;

        await transport.sendMail({
            from,
            to,
            subject: 'Thanima - Test Email',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #7c3aed; margin: 0 0 16px 0;">SMTP Configuration Test</h2>
        <p style="color: #333; margin: 0 0 12px 0;">
            This is a test email from the Thanima ticket management system.
        </p>
        <p style="color: #333; margin: 0 0 12px 0;">
            If you received this email, your SMTP configuration is working correctly.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
            Sent at ${new Date().toISOString()}
        </p>
    </div>
</body>
</html>`,
        });

        return NextResponse.json({ message: 'Test email sent successfully' });
    } catch (error: any) {
        console.error('Test email error:', error);
        return NextResponse.json(
            { error: `Failed to send test email: ${error.message}` },
            { status: 500 }
        );
    }
}
