'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BoxyFrame } from '@/components/boxy';
import { useToast } from '@/hooks/use-toast';

interface TicketTemplate {
    imagePath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    regNoPosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
}

interface TicketTemplateEditorProps {
    eventId: string;
    template?: TicketTemplate;
    onSave: () => void;
}

// Color presets for quick selection
const colorPresets = [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Gold', value: '#FFD700' },
    { name: 'Silver', value: '#C0C0C0' },
    { name: 'Navy', value: '#001F3F' },
    { name: 'Burgundy', value: '#800020' },
    { name: 'Forest', value: '#228B22' },
    { name: 'Purple', value: '#6B21A8' },
];

// Font family options
const fontFamilies = [
    { name: 'Arial', value: 'Arial' },
    { name: 'Times New Roman', value: 'Times New Roman' },
    { name: 'Georgia', value: 'Georgia' },
    { name: 'Courier New', value: 'Courier New' },
    { name: 'Verdana', value: 'Verdana' },
    { name: 'Impact', value: 'Impact' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS' },
];

export function TicketTemplateEditor({ eventId, template, onSave }: TicketTemplateEditorProps) {
    const { toast } = useToast();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [imagePath, setImagePath] = useState(template?.imagePath || '');
    const [qrPosition, setQrPosition] = useState(
        template?.qrPosition || { x: 50, y: 50, width: 150, height: 150 }
    );
    const [namePosition, setNamePosition] = useState(
        template?.namePosition || { x: 50, y: 250, fontSize: 24, color: '#000000', fontFamily: 'Arial' }
    );
    const [regNoPosition, setRegNoPosition] = useState(
        template?.regNoPosition || { x: 50, y: 300, fontSize: 18, color: '#000000', fontFamily: 'Arial' }
    );
    const [dragging, setDragging] = useState<'qr' | 'name' | 'regNo' | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [scale, setScale] = useState(1);

    // Draw the preview
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !imagePath) return;

        const img = new Image();
        // The poster is served from a (cross-origin) presigned S3 URL; without this
        // the canvas would be tainted and the editor preview would fail to render.
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Scale to fit container
            const container = containerRef.current;
            if (!container) return;

            const maxWidth = container.clientWidth - 20;
            const maxHeight = 600;
            const scaleX = maxWidth / img.width;
            const scaleY = maxHeight / img.height;
            const newScale = Math.min(scaleX, scaleY, 1);
            setScale(newScale);

            canvas.width = img.width * newScale;
            canvas.height = img.height * newScale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Draw QR placeholder
            const scaledQr = {
                x: qrPosition.x * newScale,
                y: qrPosition.y * newScale,
                width: qrPosition.width * newScale,
                height: qrPosition.height * newScale,
            };
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(scaledQr.x, scaledQr.y, scaledQr.width, scaledQr.height);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(scaledQr.x, scaledQr.y, scaledQr.width, scaledQr.height);
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.fillText('QR Code', scaledQr.x + 5, scaledQr.y + 15);

            // Draw name placeholder
            const scaledName = {
                x: namePosition.x * newScale,
                y: namePosition.y * newScale,
                fontSize: namePosition.fontSize * newScale,
            };
            ctx.fillStyle = namePosition.color;
            const nameFontFamily = namePosition.fontFamily || 'Arial';
            ctx.font = `bold ${scaledName.fontSize}px ${nameFontFamily}`;
            ctx.fillText('John Doe', scaledName.x, scaledName.y);

            // Draw name bounding box
            const nameWidth = ctx.measureText('John Doe').width;
            ctx.strokeStyle = '#bdbdbd';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(
                scaledName.x - 5,
                scaledName.y - scaledName.fontSize,
                nameWidth + 10,
                scaledName.fontSize + 10
            );

            // Draw regNo placeholder
            const scaledRegNo = {
                x: regNoPosition.x * newScale,
                y: regNoPosition.y * newScale,
                fontSize: regNoPosition.fontSize * newScale,
            };
            ctx.fillStyle = regNoPosition.color;
            const regNoFontFamily = regNoPosition.fontFamily || 'Arial';
            ctx.font = `bold ${scaledRegNo.fontSize}px ${regNoFontFamily}`;
            ctx.fillText('REG001', scaledRegNo.x, scaledRegNo.y);

            // Draw regNo bounding box
            const regNoWidth = ctx.measureText('REG001').width;
            ctx.strokeStyle = '#8a8a8a';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(
                scaledRegNo.x - 5,
                scaledRegNo.y - scaledRegNo.fontSize,
                regNoWidth + 10,
                scaledRegNo.fontSize + 10
            );

            ctx.setLineDash([]);

            setImageLoaded(true);
        };
        img.src = imagePath;
    }, [imagePath, qrPosition, namePosition, regNoPosition]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`/api/events/${eventId}/template`, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setImagePath(data.imagePath);
            toast({ title: 'Template Uploaded' });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Upload failed',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    }

    async function handleDeleteImage() {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/events/${eventId}/template?type=template`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setImagePath('');
            setImageLoaded(false);
            toast({ title: 'Poster Removed' });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Delete failed',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    }

    function handleMouseDown(e: React.MouseEvent) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        // Check if clicking on QR
        if (
            x >= qrPosition.x &&
            x <= qrPosition.x + qrPosition.width &&
            y >= qrPosition.y &&
            y <= qrPosition.y + qrPosition.height
        ) {
            setDragging('qr');
            setDragOffset({ x: x - qrPosition.x, y: y - qrPosition.y });
            return;
        }

        // Check if clicking on name (approximate)
        const nameHeight = namePosition.fontSize;
        if (
            x >= namePosition.x - 5 &&
            x <= namePosition.x + 150 &&
            y >= namePosition.y - nameHeight &&
            y <= namePosition.y + 10
        ) {
            setDragging('name');
            setDragOffset({ x: x - namePosition.x, y: y - namePosition.y });
            return;
        }

        // Check if clicking on regNo (approximate)
        const regNoHeight = regNoPosition.fontSize;
        if (
            x >= regNoPosition.x - 5 &&
            x <= regNoPosition.x + 150 &&
            y >= regNoPosition.y - regNoHeight &&
            y <= regNoPosition.y + 10
        ) {
            setDragging('regNo');
            setDragOffset({ x: x - regNoPosition.x, y: y - regNoPosition.y });
        }
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (!dragging) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        if (dragging === 'qr') {
            setQrPosition((prev) => ({
                ...prev,
                x: Math.max(0, x - dragOffset.x),
                y: Math.max(0, y - dragOffset.y),
            }));
        } else if (dragging === 'name') {
            setNamePosition((prev) => ({
                ...prev,
                x: Math.max(0, x - dragOffset.x),
                y: Math.max(prev.fontSize, y - dragOffset.y),
            }));
        } else if (dragging === 'regNo') {
            setRegNoPosition((prev) => ({
                ...prev,
                x: Math.max(0, x - dragOffset.x),
                y: Math.max(prev.fontSize, y - dragOffset.y),
            }));
        }
    }

    function handleMouseUp() {
        setDragging(null);
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/events/${eventId}/template`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrPosition, namePosition, regNoPosition }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast({ title: 'Template Settings Saved' });
            onSave();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Save failed',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Side - Template Preview */}
            <div className="lg:flex-1 space-y-4">
                {/* Upload Section */}
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        variant={imagePath ? 'outline' : 'default'}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isUploading ? 'Uploading…' : imagePath ? 'Replace Poster' : 'Upload Poster'}
                    </Button>
                    {imagePath && (
                        <Button
                            onClick={() => handleDeleteImage()}
                            disabled={isDeleting}
                            variant="destructive"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {isDeleting ? 'Removing…' : 'Delete Poster'}
                        </Button>
                    )}
                    {imagePath && (
                        <span className="text-sm text-emerald-300 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Poster loaded
                        </span>
                    )}
                </div>

                {/* Canvas Preview */}
                {imagePath ? (
                    <BoxyFrame className="bg-card/40">
                        <div
                            ref={containerRef}
                            className="overflow-hidden"
                        >
                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                className="cursor-move"
                            />
                        </div>
                    </BoxyFrame>
                ) : (
                    <div
                        ref={containerRef}
                        className="border border-dashed border-border h-80 flex items-center justify-center bg-card/30"
                    >
                        <div className="text-center">
                            <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-muted-foreground text-sm">Upload a poster image to begin</p>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                {imageLoaded && (
                    <div className="bg-card/40 border border-border p-3">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-muted-foreground">
                                Drag the <span className="text-foreground">QR code</span>, <span className="text-foreground">name</span>, and <span className="text-foreground">reg. number</span> placeholders to position them on the poster.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Side - Controls */}
            {imageLoaded && (
                <div className="lg:w-80 space-y-4">
                    {/* QR Code Settings */}
                    <BoxyFrame className="bg-card/40 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-accent flex items-center justify-center">
                                <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">QR Code</h3>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-muted-foreground text-xs">Size</Label>
                                <span className="text-foreground text-xs font-medium">{qrPosition.width}px</span>
                            </div>
                            <Slider
                                value={[qrPosition.width]}
                                onValueChange={(value) =>
                                    setQrPosition((prev) => ({
                                        ...prev,
                                        width: value[0],
                                        height: value[0],
                                    }))
                                }
                                min={50}
                                max={400}
                                step={10}
                                className="[&_[role=slider]]:bg-foreground [&_[role=slider]]:border-foreground"
                            />
                        </div>
                    </BoxyFrame>

                    {/* Name Text Settings */}
                    <BoxyFrame className="bg-card/40 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-accent flex items-center justify-center">
                                <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Name Text</h3>
                        </div>

                        {/* Font Size Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-muted-foreground text-xs">Font Size</Label>
                                <span className="text-foreground text-xs font-medium">{namePosition.fontSize}px</span>
                            </div>
                            <Slider
                                value={[namePosition.fontSize]}
                                onValueChange={(value) =>
                                    setNamePosition((prev) => ({
                                        ...prev,
                                        fontSize: value[0],
                                    }))
                                }
                                min={12}
                                max={72}
                                step={1}
                                className="[&_[role=slider]]:bg-foreground [&_[role=slider]]:border-foreground"
                            />
                        </div>

                        {/* Font Family Select */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Font Family</Label>
                            <Select
                                value={namePosition.fontFamily || 'Arial'}
                                onValueChange={(value) =>
                                    setNamePosition((prev) => ({
                                        ...prev,
                                        fontFamily: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="bg-muted border-border text-foreground h-9 text-sm">
                                    <SelectValue placeholder="Select font" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    {fontFamilies.map((font) => (
                                        <SelectItem
                                            key={font.value}
                                            value={font.value}
                                            className="text-foreground hover:bg-accent focus:bg-muted text-sm"
                                            style={{ fontFamily: font.value }}
                                        >
                                            {font.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Color Selection */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Text Color</Label>

                            {/* Color Presets */}
                            <div className="flex flex-wrap gap-1.5">
                                {colorPresets.map((preset) => (
                                    <button
                                        key={preset.value}
                                        onClick={() =>
                                            setNamePosition((prev) => ({
                                                ...prev,
                                                color: preset.value,
                                            }))
                                        }
                                        className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${namePosition.color === preset.value
                                            ? 'border-white ring-2 ring-white/30 scale-110'
                                            : 'border-border hover:border-border'
                                            }`}
                                        style={{ backgroundColor: preset.value }}
                                        title={preset.name}
                                    />
                                ))}
                            </div>

                            {/* Custom Color Picker */}
                            <div className="flex items-center gap-2 mt-2">
                                <div className="relative flex-1">
                                    <input
                                        type="color"
                                        value={namePosition.color}
                                        onChange={(e) =>
                                            setNamePosition((prev) => ({
                                                ...prev,
                                                color: e.target.value,
                                            }))
                                        }
                                        className="sr-only peer"
                                        id="custom-color"
                                    />
                                    <label
                                        htmlFor="custom-color"
                                        className="flex items-center gap-2 px-2.5 py-1.5 bg-muted border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                                    >
                                        <div
                                            className="w-4 h-4 rounded border border-border"
                                            style={{ backgroundColor: namePosition.color }}
                                        />
                                        <span className="text-muted-foreground text-xs">Custom</span>
                                    </label>
                                </div>
                                <span className="text-muted-foreground text-xs font-mono bg-muted px-2 py-1.5">{namePosition.color.toUpperCase()}</span>
                            </div>
                        </div>
                    </BoxyFrame>

                    {/* Registration Number Settings */}
                    <BoxyFrame className="bg-card/40 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-accent flex items-center justify-center">
                                <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .884-.956 2-2.25 2-1.294 0-2.25-1.116-2.25-2 0-.884.956-2 2.25-2 1.294 0 2.25 1.116 2.25 2z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Registration Number</h3>
                        </div>

                        {/* Font Size Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-muted-foreground text-xs">Font Size</Label>
                                <span className="text-foreground text-xs font-medium">{regNoPosition.fontSize}px</span>
                            </div>
                            <Slider
                                value={[regNoPosition.fontSize]}
                                onValueChange={(value) =>
                                    setRegNoPosition((prev) => ({
                                        ...prev,
                                        fontSize: value[0],
                                    }))
                                }
                                min={12}
                                max={72}
                                step={1}
                                className="[&_[role=slider]]:bg-foreground [&_[role=slider]]:border-foreground"
                            />
                        </div>

                        {/* Font Family Select */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Font Family</Label>
                            <Select
                                value={regNoPosition.fontFamily || 'Arial'}
                                onValueChange={(value) =>
                                    setRegNoPosition((prev) => ({
                                        ...prev,
                                        fontFamily: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="bg-muted border-border text-foreground h-9 text-sm">
                                    <SelectValue placeholder="Select font" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    {fontFamilies.map((font) => (
                                        <SelectItem
                                            key={font.value}
                                            value={font.value}
                                            className="text-foreground hover:bg-accent focus:bg-muted text-sm"
                                            style={{ fontFamily: font.value }}
                                        >
                                            {font.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Color Selection */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Text Color</Label>

                            {/* Color Presets */}
                            <div className="flex flex-wrap gap-1.5">
                                {colorPresets.map((preset) => (
                                    <button
                                        key={preset.value}
                                        onClick={() =>
                                            setRegNoPosition((prev) => ({
                                                ...prev,
                                                color: preset.value,
                                            }))
                                        }
                                        className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${regNoPosition.color === preset.value
                                            ? 'border-white ring-2 ring-white/30 scale-110'
                                            : 'border-border hover:border-border'
                                            }`}
                                        style={{ backgroundColor: preset.value }}
                                        title={preset.name}
                                    />
                                ))}
                            </div>

                            {/* Custom Color Picker */}
                            <div className="flex items-center gap-2 mt-2">
                                <div className="relative flex-1">
                                    <input
                                        type="color"
                                        value={regNoPosition.color}
                                        onChange={(e) =>
                                            setRegNoPosition((prev) => ({
                                                ...prev,
                                                color: e.target.value,
                                            }))
                                        }
                                        className="sr-only peer"
                                        id="reg-custom-color"
                                    />
                                    <label
                                        htmlFor="reg-custom-color"
                                        className="flex items-center gap-2 px-2.5 py-1.5 bg-muted border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                                    >
                                        <div
                                            className="w-4 h-4 rounded border border-border"
                                            style={{ backgroundColor: regNoPosition.color }}
                                        />
                                        <span className="text-muted-foreground text-xs">Custom</span>
                                    </label>
                                </div>
                                <span className="text-muted-foreground text-xs font-mono bg-muted px-2 py-1.5">{regNoPosition.color.toUpperCase()}</span>
                            </div>
                        </div>
                    </BoxyFrame>

                    {/* Save Button */}
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-5 font-semibold"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isSaving ? 'Saving…' : 'Save Layout'}
                    </Button>
                </div>
            )}
        </div>
    );
}
