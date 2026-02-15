import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

interface TicketGenerationOptions {
    templateImagePath: string;
    qrPayload: string;
    name: string;
    regNo: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    regNoPosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    qrLogoPath?: string;
    rotateTicket?: boolean;
}

/**
 * Generate a ticket image server-side using node-canvas.
 * Mirrors the client-side rendering logic from TicketDownloadSection.tsx.
 * Returns a PNG Buffer.
 */
export async function generateTicketImage(options: TicketGenerationOptions): Promise<Buffer> {
    const {
        templateImagePath,
        qrPayload,
        name,
        regNo,
        qrPosition,
        namePosition,
        regNoPosition,
        rotateTicket,
    } = options;

    // Resolve the template image path from public directory
    const absolutePath = path.join(process.cwd(), 'public', templateImagePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Template image not found: ${templateImagePath}`);
    }

    // Load the template image
    const templateImg = await loadImage(absolutePath);

    // Create canvas with template dimensions
    const canvas = createCanvas(templateImg.width, templateImg.height);
    const ctx = canvas.getContext('2d');

    // Draw template background
    ctx.drawImage(templateImg, 0, 0);

    // Generate QR code as data URL and draw it
    if (qrPosition) {
        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
            width: qrPosition.width,
        });

        const qrImg = await loadImage(qrDataUrl);
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
