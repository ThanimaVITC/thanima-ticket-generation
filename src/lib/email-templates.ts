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

/** The token an author drops into the body where the colour block should appear. */
export const COLOR_BOX_TOKEN = '{{color-box}}';

/**
 * Variables that may legitimately be blank. A body line referencing one of these is
 * dropped entirely when it resolves to nothing — otherwise an event with no sitting
 * time mails out "Your sitting is at ." Only these are treated this way; a blank
 * {{regNo}} must not silently delete a line the author meant to send.
 */
const OPTIONAL_VARS = ['timing'];

export interface FoodEmailTemplate {
    subject: string;
    heading: string;
    body: string;
    colorBoxLabel: string;
    footer: string;
}

export const DEFAULT_FOOD_EMAIL_TEMPLATE: FoodEmailTemplate = {
    subject: 'You are checked in for {{eventTitle}}',
    heading: "You're checked in",
    body: [
        'Hi {{name}},',
        '',
        'You are checked in for {{eventTitle}}. Your food colour is below.',
        '',
        COLOR_BOX_TOKEN,
        '',
        'Your sitting is at {{timing}}.',
        '',
        'Go to the {{color}} counter and show your ticket QR code to be served.',
    ].join('\n'),
    colorBoxLabel: 'Your food colour',
    footer: 'One serving per person. Bring the same ticket you checked in with.',
};

// Kept for callers that only want the two original fields.
export const DEFAULT_FOOD_EMAIL_SUBJECT = DEFAULT_FOOD_EMAIL_TEMPLATE.subject;
export const DEFAULT_FOOD_EMAIL_BODY = DEFAULT_FOOD_EMAIL_TEMPLATE.body;

/** Fills in any field an older saved template predates. */
export function withFoodEmailDefaults(t?: Partial<FoodEmailTemplate> | null): FoodEmailTemplate {
    return {
        subject: t?.subject || DEFAULT_FOOD_EMAIL_TEMPLATE.subject,
        heading: t?.heading ?? DEFAULT_FOOD_EMAIL_TEMPLATE.heading,
        body: t?.body || DEFAULT_FOOD_EMAIL_TEMPLATE.body,
        colorBoxLabel: t?.colorBoxLabel ?? DEFAULT_FOOD_EMAIL_TEMPLATE.colorBoxLabel,
        footer: t?.footer ?? DEFAULT_FOOD_EMAIL_TEMPLATE.footer,
    };
}

/**
 * The "you're checked in, here's your food colour" email. Every visible string comes
 * from the template — nothing is hardcoded prose.
 *
 * Two things drive the markup:
 *
 * 1. The colour is never the only carrier of the message. Roughly 8% of men have a
 *    colour vision deficiency, and this palette contains both red/green and the
 *    near-pairs red/pink and purple/pink. So the colour NAME is set large inside the
 *    swatch — someone who cannot tell the swatch apart can still read "RED".
 * 2. Outlook ignores CSS backgrounds on divs and strips <style> blocks, so the
 *    swatch is a table cell carrying both the `bgcolor` attribute and an inline
 *    style. Belt and braces is the only thing that renders everywhere.
 */
export function buildFoodColorEmailHtml({
    template,
    variables,
    colorName,
    colorHex,
}: {
    template: Partial<FoodEmailTemplate>;
    variables: Record<string, string>;
    colorName: string;
    colorHex: string;
}): string {
    const t = withFoodEmailDefaults(template);
    const text = (s: string) => escapeHtml(renderEmailTemplate(s, variables));

    // A line that is nothing but the token becomes the colour block. Everything else is a
    // paragraph. Line-level rather than inline because the block is a <table>, which
    // cannot sit inside a <p> and stay valid in Outlook.
    const blocks = t.body
        .split('\n')
        .filter((line) => {
            if (!line.trim()) return false;
            return !OPTIONAL_VARS.some(
                (v) => line.includes(`{{${v}}}`) && !(variables[v] ?? '').trim()
            );
        })
        .map((line) =>
            line.trim() === COLOR_BOX_TOKEN
                ? colorBox(colorName, colorHex, text(t.colorBoxLabel))
                : `<p style="margin: 0 0 16px 0; color: #333333; line-height: 1.6; font-size: 15px;">${text(line)}</p>`
        )
        .join('\n');

    const footer = t.footer.trim()
        ? `<p style="margin: 32px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5; text-align: center; padding-top: 24px; border-top: 1px solid #eeeeee;">${text(t.footer)}</p>`
        : '';

    const heading = t.heading.trim()
        ? `<div style="padding: 32px; border-bottom: 1px solid #eeeeee; text-align: center;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #111111; letter-spacing: -0.5px;">${text(t.heading)}</h2>
        </div>`
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
        ${heading}
        <div style="padding: 32px;">
${blocks}
            ${footer}
        </div>
    </div>
</body>
</html>`.trim();
}

/** The colour swatch. Centre aligned, full width of the message column. */
function colorBox(colorName: string, colorHex: string, label: string): string {
    const ink = onColor(colorHex);
    return `            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px 0;">
                <tr>
                    <td bgcolor="${colorHex}" align="center"
                        style="background-color: ${colorHex}; border-radius: 8px; padding: 28px 16px; text-align: center;">
                        <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: ${ink}; opacity: 0.85;">
                            ${label}
                        </div>
                        <div style="font-size: 38px; font-weight: 700; letter-spacing: 1px; color: ${ink}; padding-top: 4px;">
                            ${escapeHtml(colorName.toUpperCase())}
                        </div>
                    </td>
                </tr>
            </table>`;
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
