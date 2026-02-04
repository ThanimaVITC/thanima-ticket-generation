'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface TicketTemplate {
    imagePath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
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
    const [dragging, setDragging] = useState<'qr' | 'name' | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [scale, setScale] = useState(1);

    // Draw the preview
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !imagePath) return;

        const img = new Image();
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
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(scaledQr.x, scaledQr.y, scaledQr.width, scaledQr.height);
            ctx.strokeStyle = '#9333ea';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(scaledQr.x, scaledQr.y, scaledQr.width, scaledQr.height);
            ctx.setLineDash([]);
            ctx.fillStyle = '#9333ea';
            ctx.font = '12px Arial';
            ctx.fillText('QR Code', scaledQr.x + 5, scaledQr.y + 15);

            // Draw name placeholder
            const scaledName = {
                x: namePosition.x * newScale,
                y: namePosition.y * newScale,
                fontSize: namePosition.fontSize * newScale,
            };
            ctx.fillStyle = namePosition.color;
            const fontFamily = namePosition.fontFamily || 'Arial';
            ctx.font = `bold ${scaledName.fontSize}px ${fontFamily}`;
            ctx.fillText('John Doe', scaledName.x, scaledName.y);

            // Draw name bounding box
            const textWidth = ctx.measureText('John Doe').width;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(
                scaledName.x - 5,
                scaledName.y - scaledName.fontSize,
                textWidth + 10,
                scaledName.fontSize + 10
            );
            ctx.setLineDash([]);

            setImageLoaded(true);
        };
        img.src = imagePath;
    }, [imagePath, qrPosition, namePosition]);

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
                body: JSON.stringify({ qrPosition, namePosition }),
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
                <div className="flex items-center gap-4">
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
                        variant="outline"
                        className="border-white/20 text-gray-300 hover:bg-white/5"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isUploading ? 'Uploading...' : imagePath ? 'Change Template' : 'Upload Template'}
                    </Button>
                    {imagePath && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Template loaded
                        </span>
                    )}
                </div>

                {/* Canvas Preview */}
                {imagePath ? (
                    <div
                        ref={containerRef}
                        className="border border-white/20 rounded-xl overflow-hidden bg-gradient-to-b from-white/5 to-transparent"
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
                ) : (
                    <div
                        ref={containerRef}
                        className="border-2 border-dashed border-white/20 rounded-xl h-80 flex items-center justify-center bg-white/5"
                    >
                        <div className="text-center">
                            <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-gray-500 text-sm">Upload a template image</p>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                {imageLoaded && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-400">
                                Drag the <span className="text-purple-400">QR code</span> and <span className="text-emerald-400">name</span> placeholders to position them on the template.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Side - Controls */}
            {imageLoaded && (
                <div className="lg:w-80 space-y-4">
                    {/* QR Code Settings */}
                    <div className="bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-white">QR Code</h3>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-gray-400 text-xs">Size</Label>
                                <span className="text-purple-400 text-xs font-medium">{qrPosition.width}px</span>
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
                                className="[&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
                            />
                        </div>
                    </div>

                    {/* Name Text Settings */}
                    <div className="bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-white">Name Text</h3>
                        </div>

                        {/* Font Size Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-gray-400 text-xs">Font Size</Label>
                                <span className="text-emerald-400 text-xs font-medium">{namePosition.fontSize}px</span>
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
                                className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-400"
                            />
                        </div>

                        {/* Font Family Select */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-xs">Font Family</Label>
                            <Select
                                value={namePosition.fontFamily || 'Arial'}
                                onValueChange={(value) =>
                                    setNamePosition((prev) => ({
                                        ...prev,
                                        fontFamily: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="bg-white/5 border-white/20 text-white h-9 text-sm">
                                    <SelectValue placeholder="Select font" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/20">
                                    {fontFamilies.map((font) => (
                                        <SelectItem
                                            key={font.value}
                                            value={font.value}
                                            className="text-white hover:bg-white/10 focus:bg-white/10 text-sm"
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
                            <Label className="text-gray-400 text-xs">Text Color</Label>

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
                                                : 'border-white/20 hover:border-white/40'
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
                                        className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                                    >
                                        <div
                                            className="w-4 h-4 rounded border border-white/30"
                                            style={{ backgroundColor: namePosition.color }}
                                        />
                                        <span className="text-gray-400 text-xs">Custom</span>
                                    </label>
                                </div>
                                <span className="text-gray-500 text-xs font-mono bg-white/5 px-2 py-1.5 rounded-lg">{namePosition.color.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-5 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/25"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isSaving ? 'Saving...' : 'Save Template'}
                    </Button>
                </div>
            )}
        </div>
    );
}
