// Pure email markup. No transport, no nodemailer — importable from a client
// component, which is what lets the dashboard preview render the exact HTML that
// gets sent rather than an approximation of it.

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
