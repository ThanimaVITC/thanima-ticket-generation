'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface TicketTemplate {
    imagePath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string };
}

interface TicketTemplateEditorProps {
    eventId: string;
    template?: TicketTemplate;
    onSave: () => void;
}

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
        template?.namePosition || { x: 50, y: 250, fontSize: 24, color: '#000000' }
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
            const maxHeight = 500;
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
            ctx.font = `bold ${scaledName.fontSize}px Arial`;
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
        <div className="space-y-4">
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
                    className="border-white/20 text-gray-300"
                >
                    {isUploading ? 'Uploading...' : imagePath ? 'Change Template' : 'Upload Template'}
                </Button>
                {imagePath && (
                    <span className="text-sm text-gray-400">Template loaded</span>
                )}
            </div>

            {/* Canvas Preview */}
            {imagePath && (
                <div
                    ref={containerRef}
                    className="border border-white/20 rounded-lg overflow-hidden bg-black/20"
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
            )}

            {/* Position Controls */}
            {imageLoaded && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-gray-300">QR Size</Label>
                        <Input
                            type="number"
                            value={qrPosition.width}
                            onChange={(e) =>
                                setQrPosition((prev) => ({
                                    ...prev,
                                    width: Number(e.target.value),
                                    height: Number(e.target.value),
                                }))
                            }
                            className="bg-white/10 border-white/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Name Font Size</Label>
                        <Input
                            type="number"
                            value={namePosition.fontSize}
                            onChange={(e) =>
                                setNamePosition((prev) => ({
                                    ...prev,
                                    fontSize: Number(e.target.value),
                                }))
                            }
                            className="bg-white/10 border-white/20"
                        />
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label className="text-gray-300">Name Color</Label>
                        <Input
                            type="color"
                            value={namePosition.color}
                            onChange={(e) =>
                                setNamePosition((prev) => ({
                                    ...prev,
                                    color: e.target.value,
                                }))
                            }
                            className="h-10 w-20"
                        />
                    </div>
                </div>
            )}

            {/* Save Button */}
            {imageLoaded && (
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                >
                    {isSaving ? 'Saving...' : 'Save Template Settings'}
                </Button>
            )}

            {/* Instructions */}
            <p className="text-xs text-gray-500">
                Drag the QR code and name placeholders to position them on the template.
            </p>
        </div>
    );
}
