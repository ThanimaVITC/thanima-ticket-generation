import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import QRCode from 'qrcode';

interface TicketGenerationOptions {
    /** Pre-decoded template background. Decode once per send session, reuse per ticket. */
    templateImage: Image;
    qrPayload: string;
    name: string;
    regNo: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    regNoPosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    rotateTicket?: boolean;
}

/**
 * Decode a template background (PNG/JPG/WEBP bytes) into a reusable Image.
 * The email-send flow fetches the poster from S3 once and decodes it once,
 * then passes the result to generateTicketImage for every attendee.
 */
export async function loadTemplateImage(buffer: Buffer): Promise<Image> {
    return loadImage(buffer);
}

/**
 * Generate a ticket image server-side using @napi-rs/canvas (serverless-safe).
 * Mirrors the client-side rendering logic from TicketDownloadSection.tsx.
 * Returns a PNG Buffer.
 */
export async function generateTicketImage(options: TicketGenerationOptions): Promise<Buffer> {
    const {
        templateImage,
        qrPayload,
        name,
        regNo,
        qrPosition,
        namePosition,
        regNoPosition,
        rotateTicket,
    } = options;

    // Create canvas with template dimensions
    const canvas = createCanvas(templateImage.width, templateImage.height);
    const ctx = canvas.getContext('2d');

    // Draw template background
    ctx.drawImage(templateImage, 0, 0);

    // Generate QR code as a PNG buffer and draw it
    if (qrPosition) {
        const qrBuffer = await QRCode.toBuffer(qrPayload, {
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
            width: qrPosition.width,
        });

        const qrImg = await loadImage(qrBuffer);
        ctx.drawImage(qrImg, qrPosition.x, qrPosition.y, qrPosition.width, qrPosition.height);
    }

    // Draw name text
    if (namePosition) {
        ctx.fillStyle = namePosition.color || '#000000';
        const fontFamily = namePosition.fontFamily || 'Arial';
        ctx.font = `bold ${namePosition.fontSize}px ${fontFamily}`;
        ctx.fillText(name, namePosition.x, namePosition.y);
    }

    // Draw registration number text
    if (regNoPosition && regNo) {
        ctx.fillStyle = regNoPosition.color || '#000000';
        const fontFamily = regNoPosition.fontFamily || 'Arial';
        ctx.font = `bold ${regNoPosition.fontSize}px ${fontFamily}`;
        ctx.fillText(regNo, regNoPosition.x, regNoPosition.y);
    }

    // Apply rotation if needed (90 degrees clockwise)
    if (rotateTicket) {
        const rotatedCanvas = createCanvas(canvas.height, canvas.width);
        const rotatedCtx = rotatedCanvas.getContext('2d');

        rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
        rotatedCtx.rotate((90 * Math.PI) / 180);
        rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

        return rotatedCanvas.toBuffer('image/png');
    }

    return canvas.toBuffer('image/png');
}
