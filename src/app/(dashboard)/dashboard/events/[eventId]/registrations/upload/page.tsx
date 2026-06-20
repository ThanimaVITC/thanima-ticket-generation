'use client';

import { useState, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle, PartyPopper, Info } from 'lucide-react';
import { BoxyFrame } from '@/components/boxy';

interface RegistrationRow {
    name: string;
    regNo: string;
    email: string;
    phone: string;
    reason?: string;
    status: 'valid' | 'duplicate' | 'rejected';
}

interface PreviewStats {
    total: number;
    valid: number;
    rejected: number;
}

interface PreviewResponse {
    valid: RegistrationRow[];
    rejected: RegistrationRow[];
    stats: PreviewStats;
}

interface ProcessedRecord {
    name: string;
    regNo: string;
    email: string;
    phone: string;
    status: 'success' | 'duplicate' | 'failed';
}

interface UploadProgress {
    processed: number;
    total: number;
    totalInserted: number;
    totalFailed: number;
    records: ProcessedRecord[];
}

export default function BulkUploadPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
        processed: 0,
        total: 0,
        totalInserted: 0,
        totalFailed: 0,
        records: [],
    });

    const feedRef = useRef<HTMLDivElement>(null);

    // Auto-scroll the feed to the bottom
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [uploadProgress.records]);

    // Handle extension sync data
    useEffect(() => {
        if (searchParams.get('source') === 'extension') {
            const raw = sessionStorage.getItem('extensionSyncData');
            if (raw) {
                sessionStorage.removeItem('extensionSyncData');
                try {
                    const students = JSON.parse(raw);
                    if (Array.isArray(students) && students.length > 0) {
                        // Filter to only include paid students
                        const paidStudents = students.filter((s: any) => s.paid === true);
                        const skippedCount = students.length - paidStudents.length;

                        if (paidStudents.length === 0) {
                            toast({
                                title: 'No Paid Students',
                                description: `All ${students.length} students have unpaid status. No data to import.`,
                                variant: 'destructive',
                            });
                            return;
                        }

                        if (skippedCount > 0) {
                            toast({
                                title: 'Unpaid Students Filtered',
                                description: `${skippedCount} unpaid student(s) were excluded. Importing ${paidStudents.length} paid student(s).`,
                            });
                        }

                        // Convert extension data to CSV and auto-preview
                        const csvHeader = 'name,regno,email,phone';
                        const csvRows = paidStudents.map((s: any) => {
                            const name = (s.name || '').replace(/,/g, ' ');
                            const regNo = (s.id || s.regNo || '').replace(/,/g, ' ');
                            const email = (s.email || '').replace(/,/g, ' ');
                            const phone = (s.phone || '').replace(/,/g, ' ');
                            return `${name},${regNo},${email},${phone}`;
                        });
                        const csvContent = [csvHeader, ...csvRows].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const csvFile = new File([blob], 'extension-import.csv', { type: 'text/csv' });

                        setFile(csvFile);

                        // Auto-trigger preview
                        (async () => {
                            setIsPreviewing(true);
                            try {
                                const formData = new FormData();
                                formData.append('file', csvFile);
                                formData.append('eventId', eventId);

                                const res = await fetch('/api/registrations/preview', {
                                    method: 'POST',
                                    body: formData,
                                });

                                const data = await res.json();
                                if (!res.ok) {
                                    throw new Error(data.error || 'Failed to preview');
                                }

                                setPreviewData(data);
                                toast({
                                    title: 'Extension Data Loaded',
                                    description: `${data.stats.valid} valid, ${data.stats.rejected} rejected out of ${data.stats.total} records`,
                                });
                            } catch (error: any) {
                                toast({
                                    title: 'Preview Failed',
                                    description: error.message,
                                    variant: 'destructive',
                                });
                            } finally {
                                setIsPreviewing(false);
                            }
                        })();
                    }
                } catch (e) {
                    toast({ title: 'Error', description: 'Failed to parse extension data', variant: 'destructive' });
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handlePreview() {
        if (!file) return;

        setIsPreviewing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('eventId', eventId);

            const res = await fetch('/api/registrations/preview', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to preview file');
            }

            setPreviewData(data);
        } catch (error: any) {
            toast({
                title: 'Preview Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsPreviewing(false);
        }
    }

    async function handleConfirmUpload() {
        if (!previewData || previewData.valid.length === 0) return;

        setIsUploading(true);
        setIsComplete(false);
        setUploadProgress({
            processed: 0,
            total: previewData.valid.length,
            totalInserted: 0,
            totalFailed: 0,
            records: [],
        });

        try {
            const res = await fetch('/api/registrations/batch-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    registrations: previewData.valid,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('Stream not available');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep incomplete data in buffer

                for (const line of lines) {
                    const dataLine = line.replace(/^data: /, '').trim();
                    if (!dataLine) continue;

                    try {
                        const sseEvent = JSON.parse(dataLine);

                        if (sseEvent.type === 'progress') {
                            setUploadProgress(prev => ({
                                processed: sseEvent.data.processed,
                                total: sseEvent.data.total,
                                totalInserted: sseEvent.data.totalInserted,
                                totalFailed: sseEvent.data.totalFailed,
                                records: [...prev.records, ...sseEvent.data.records],
                            }));
                        } else if (sseEvent.type === 'complete') {
                            setIsComplete(true);
                            setUploadProgress(prev => ({
                                ...prev,
                                processed: sseEvent.data.total,
                                totalInserted: sseEvent.data.totalInserted,
                                totalFailed: sseEvent.data.totalFailed,
                            }));
                        } else if (sseEvent.type === 'error') {
                            throw new Error(sseEvent.data.message);
                        }
                    } catch (parseError: any) {
                        if (parseError.message && parseError.message !== 'Unexpected token') throw parseError;
                        // Ignore JSON parse errors from incomplete data
                    }
                }
            }
        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message,
                variant: 'destructive',
            });
            setIsUploading(false);
        }
    }

    const resetUpload = () => {
        setFile(null);
        setPreviewData(null);
        setIsUploading(false);
        setIsComplete(false);
        setUploadProgress({ processed: 0, total: 0, totalInserted: 0, totalFailed: 0, records: [] });
    };

    const progressPercentage = uploadProgress.total > 0
        ? Math.round((uploadProgress.processed / uploadProgress.total) * 100)
        : 0;

    // ─── Upload Animation View ───────────────────────
    if (isUploading || isComplete) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <style jsx>{`
                    @keyframes fadeSlideUp {
                        from {
                            opacity: 0;
                            transform: translateY(16px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    @keyframes shimmer {
                        0% {
                            background-position: -200% 0;
                        }
                        100% {
                            background-position: 200% 0;
                        }
                    }
                    @keyframes successPop {
                        0% { transform: scale(0.8); opacity: 0; }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    .record-enter {
                        animation: fadeSlideUp 0.4s ease-out forwards;
                    }
                    .progress-bar-shimmer {
                        background: linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.3) 0%,
                            rgba(255, 255, 255, 0.6) 50%,
                            rgba(255, 255, 255, 0.3) 100%
                        );
                        background-size: 200% 100%;
                        animation: shimmer 1.5s linear infinite;
                    }
                    .success-pop {
                        animation: successPop 0.5s ease-out forwards;
                    }
                `}</style>

                <div className="flex items-center space-x-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Event</div>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                            {isComplete ? (
                                <>
                                    <PartyPopper className="h-7 w-7 text-emerald-300" />
                                    Upload Complete!
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white/70"></span>
                                    </span>
                                    Uploading Registrations...
                                </>
                            )}
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            {isComplete
                                ? `Successfully processed ${uploadProgress.total} registrations`
                                : `Processing ${uploadProgress.processed} of ${uploadProgress.total} registrations`
                            }
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <BoxyFrame className="bg-card/40 text-foreground">
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="text-foreground font-mono font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="w-full h-3 bg-muted overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${isComplete ? 'bg-emerald-400' : 'progress-bar-shimmer'
                                    }`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{uploadProgress.processed} processed</span>
                            <span>{uploadProgress.total} total</span>
                        </div>
                    </CardContent>
                </BoxyFrame>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <BoxyFrame className="bg-card/40 text-foreground">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            <CheckCircle className="h-8 w-8 text-emerald-300" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums text-foreground">{uploadProgress.totalInserted}</p>
                                <p className="text-sm text-muted-foreground">Inserted</p>
                            </div>
                        </CardContent>
                    </BoxyFrame>
                    <BoxyFrame className="bg-card/40 text-foreground">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            <XCircle className="h-8 w-8 text-rose-300" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums text-foreground">{uploadProgress.totalFailed}</p>
                                <p className="text-sm text-muted-foreground">Failed / Duplicates</p>
                            </div>
                        </CardContent>
                    </BoxyFrame>
                    <BoxyFrame className="bg-card/40 text-foreground">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums text-foreground">{uploadProgress.processed} / {uploadProgress.total}</p>
                                <p className="text-sm text-muted-foreground">Processed</p>
                            </div>
                        </CardContent>
                    </BoxyFrame>
                </div>

                {/* Live Record Feed */}
                <BoxyFrame className="bg-card/40 text-foreground">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {!isComplete && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white/70"></span>
                                </span>
                            )}
                            Live Feed
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Registrations being added in real time
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div ref={feedRef} className="max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted sticky top-0 z-10">
                                    <TableRow className="border-border">
                                        <TableHead className="text-muted-foreground w-8">#</TableHead>
                                        <TableHead className="text-muted-foreground">Name</TableHead>
                                        <TableHead className="text-muted-foreground">Reg No</TableHead>
                                        <TableHead className="text-muted-foreground">Email</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {uploadProgress.records.map((record, i) => (
                                        <TableRow
                                            key={i}
                                            className="border-border record-enter"
                                            style={{ animationDelay: `${(i % 5) * 80}ms` }}
                                        >
                                            <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                                            <TableCell className="font-medium text-foreground">{record.name}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono">{record.regNo}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{record.email}</TableCell>
                                            <TableCell>
                                                {record.status === 'success' ? (
                                                    <Badge variant="success" className="gap-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        Added
                                                    </Badge>
                                                ) : record.status === 'duplicate' ? (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Duplicate
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="gap-1">
                                                        <XCircle className="h-3 w-3" />
                                                        Failed
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Loading skeleton rows while processing */}
                                    {!isComplete && (
                                        <>
                                            {[...Array(3)].map((_, i) => (
                                                <TableRow key={`skeleton-${i}`} className="border-border">
                                                    <TableCell colSpan={5}>
                                                        <div className="h-4 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </BoxyFrame>

                {/* Completion Actions */}
                {isComplete && (
                    <div className="success-pop">
                        <BoxyFrame className="bg-card/40 text-foreground">
                            <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 border border-emerald-900/60 bg-emerald-900/20 flex items-center justify-center">
                                        <CheckCircle className="h-6 w-6 text-emerald-300" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg">All registrations processed!</p>
                                        <p className="text-sm text-muted-foreground">
                                            {uploadProgress.totalInserted} added successfully
                                            {uploadProgress.totalFailed > 0 && `, ${uploadProgress.totalFailed} skipped`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={resetUpload}>
                                        Upload More
                                    </Button>
                                    <Link href={`/dashboard/events/${eventId}/registrations`}>
                                        <Button>
                                            View Registrations
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </BoxyFrame>
                    </div>
                )}
            </div>
        );
    }

    // ─── Normal Preview / File Select View ───────────
    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center space-x-4">
                <Link href={`/dashboard/events/${eventId}/registrations`}>
                    <Button variant="ghost" size="icon" className="hover:bg-accent">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Event</div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Bulk Registration Upload</h2>
                    <p className="text-muted-foreground">Upload CSV or XLS files to register attendees in bulk.</p>
                </div>
            </div>

            {!previewData ? (
                <BoxyFrame className="bg-card/40 text-foreground">
                    <CardHeader>
                        <CardTitle>Select File</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Supported formats: .csv, .xls, .xlsx
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-medium text-foreground mb-1">Expected File Format</p>
                                    <p className="text-muted-foreground mb-2">
                                        The <strong>first row</strong> of your Excel or CSV file must contain these exact column titles:
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <Badge variant="outline">name</Badge>
                                        <Badge variant="outline">regno</Badge>
                                        <Badge variant="outline">email</Badge>
                                        <Badge variant="outline">phone</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        Alternatively, an exported sheet with columns <strong className="font-mono text-muted-foreground text-[10px]">Id, Name, Email, Ph_No, Payment Status</strong> is also supported (only "Paid" accepted).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-border p-10 flex flex-col items-center justify-center space-y-4 hover:bg-foreground/90/5 transition-colors">
                            <Upload className="h-10 w-10 text-muted-foreground" />
                            <div className="text-center">
                                <p className="text-lg font-medium">Click to upload or drag and drop</p>
                                <p className="text-sm text-muted-foreground">CSV or Excel files only</p>
                            </div>
                            <Input
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="max-w-xs bg-card border-border text-foreground placeholder:text-muted-foreground"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handlePreview}
                                disabled={!file || isPreviewing}
                            >
                                {isPreviewing ? 'Analyzing...' : 'Preview Data'}
                            </Button>
                        </div>
                    </CardContent>
                </BoxyFrame>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <BoxyFrame className="bg-card/40 text-foreground">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <CheckCircle className="h-8 w-8 text-emerald-300" />
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{previewData.stats.valid}</p>
                                    <p className="text-sm text-muted-foreground">Valid Records</p>
                                </div>
                            </CardContent>
                        </BoxyFrame>
                        <BoxyFrame className="bg-card/40 text-foreground">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <XCircle className="h-8 w-8 text-rose-300" />
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{previewData.stats.rejected}</p>
                                    <p className="text-sm text-muted-foreground">Rejected Records</p>
                                </div>
                            </CardContent>
                        </BoxyFrame>
                        <BoxyFrame className="bg-card/40 text-foreground">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{previewData.stats.total}</p>
                                    <p className="text-sm text-muted-foreground">Total Processed</p>
                                </div>
                            </CardContent>
                        </BoxyFrame>
                    </div>

                    <BoxyFrame className="bg-card/40 text-foreground">
                        <Tabs defaultValue="valid" className="w-full">
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <TabsList className="bg-muted border border-border">
                                    <TabsTrigger value="valid">Valid ({previewData.stats.valid})</TabsTrigger>
                                    <TabsTrigger value="rejected">Rejected ({previewData.stats.rejected})</TabsTrigger>
                                </TabsList>
                                <div className="space-x-2">
                                    <Button variant="outline" onClick={resetUpload}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleConfirmUpload}
                                        disabled={previewData.stats.valid === 0 || isUploading}
                                    >
                                        {isUploading ? 'Uploading...' : 'Confirm & Upload'}
                                    </Button>
                                </div>
                            </div>

                            <TabsContent value="valid" className="m-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted sticky top-0">
                                            <TableRow className="border-border">
                                                <TableHead className="text-muted-foreground">Name</TableHead>
                                                <TableHead className="text-muted-foreground">Reg No</TableHead>
                                                <TableHead className="text-muted-foreground">Email</TableHead>
                                                <TableHead className="text-muted-foreground">Phone</TableHead>
                                                <TableHead className="text-muted-foreground">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.valid.map((row, i) => (
                                                <TableRow key={i} className="border-border hover:bg-foreground/90/5">
                                                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">{row.regNo}</TableCell>
                                                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                                                    <TableCell className="text-muted-foreground">{row.phone}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="success">
                                                            Ready
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="rejected" className="m-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted sticky top-0">
                                            <TableRow className="border-border">
                                                <TableHead className="text-muted-foreground">Name</TableHead>
                                                <TableHead className="text-muted-foreground">Email</TableHead>
                                                <TableHead className="text-muted-foreground">Reason</TableHead>
                                                <TableHead className="text-muted-foreground">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.rejected.map((row, i) => (
                                                <TableRow key={i} className="border-border hover:bg-foreground/90/5">
                                                    <TableCell className="font-medium text-muted-foreground">{row.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                                                    <TableCell className="text-rose-300">{row.reason}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="destructive">
                                                            Rejected
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {previewData.stats.rejected === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                        No rejected records
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </BoxyFrame>
                </div>
            )}
        </div>
    );
}
