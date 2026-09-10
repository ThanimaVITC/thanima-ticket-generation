// Browser-side downloads. One copy for every list the dashboard exports — unpaid,
// food scans, applicants — plus the chart-to-PNG saver, so the BOM quirk, the lazy
// xlsx import and the canvas dance are each fixed in one place.

export function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/** Filename-safe stem: "Sargam 2026" + "food" -> "Sargam_2026_food". */
export function exportFileName(eventTitle: string, suffix: string) {
    return `${(eventTitle || 'event').replace(/[^a-zA-Z0-9]/g, '_')}_${suffix}`;
}

export function downloadCsv(headers: readonly string[], rows: string[][], fileName: string) {
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');

    // BOM so Excel reads the file as UTF-8 instead of mangling accented names.
    triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
}

// xlsx is already a dependency, but it is a heavy one. Loading it on demand keeps it
// out of every page bundle that never actually builds a workbook.
export async function downloadXlsx(
    headers: readonly string[],
    rows: string[][],
    fileName: string,
    { sheetName = 'Sheet1', colWidths }: { sheetName?: string; colWidths?: number[] } = {}
) {
    const XLSX = await import('xlsx');

    const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows]);
    // Excel's default column width truncates most names on open.
    sheet['!cols'] = (colWidths ?? headers.map(() => 22)).map((wch) => ({ wch }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetName);
    XLSX.writeFile(book, `${fileName}.xlsx`);
}

/**
 * Save a rendered chart as a PNG.
 *
 * Recharts draws inline SVG with inline fills, so a detached clone keeps its colours
 * without dragging a stylesheet along — only the font has to be re-applied by hand.
 * Drawing through a canvas at 2x keeps the text crisp, and the background is painted
 * first because a transparent PNG is unreadable in most viewers.
 */
export async function downloadChartPng(svg: SVGSVGElement, fileName: string, scale = 2) {
    const width = svg.clientWidth || Number(svg.getAttribute('width')) || 640;
    const height = svg.clientHeight || Number(svg.getAttribute('height')) || 300;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.style.fontFamily = getComputedStyle(svg).fontFamily;

    const pageBg = getComputedStyle(document.body).backgroundColor;
    const background = !pageBg || pageBg === 'transparent' || pageBg === 'rgba(0, 0, 0, 0)' ? '#ffffff' : pageBg;

    const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
    );

    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Could not rasterise the chart'));
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is unavailable');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not encode the PNG');
        triggerDownload(blob, `${fileName}.png`);
    } finally {
        URL.revokeObjectURL(url);
    }
}
