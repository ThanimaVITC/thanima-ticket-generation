'use client';

import { useState, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle, Loader2, PartyPopper } from 'lucide-react';

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
                    @keyframes pulse-glow {
                        0%, 100% {
                            box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
                        }
                        50% {
                            box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
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
                    .progress-bar-glow {
                        animation: pulse-glow 2s ease-in-out infinite;
                    }
                    .progress-bar-shimmer {
                        background: linear-gradient(
                            90deg,
                            rgba(168, 85, 247, 0.8) 0%,
                            rgba(192, 132, 252, 1) 50%,
                            rgba(168, 85, 247, 0.8) 100%
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
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            {isComplete ? (
                                <>
                                    <PartyPopper className="h-7 w-7 text-green-400" />
                                    Upload Complete!
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                    </span>
                                    Uploading Registrations...
                                </>
                            )}
                        </h2>
                        <p className="text-gray-400 mt-1">
                            {isComplete
                                ? `Successfully processed ${uploadProgress.total} registrations`
                                : `Processing ${uploadProgress.processed} of ${uploadProgress.total} registrations`
                            }
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <Card className="bg-slate-900 border-white/10 text-white overflow-hidden">
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-purple-300 font-mono font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden progress-bar-glow">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${isComplete ? 'bg-green-500' : 'progress-bar-shimmer'
                                    }`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{uploadProgress.processed} processed</span>
                            <span>{uploadProgress.total} total</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-green-500/10 border-green-500/20 text-green-100">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            <CheckCircle className="h-8 w-8 text-green-400" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums">{uploadProgress.totalInserted}</p>
                                <p className="text-sm opacity-80">Inserted</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/20 text-red-100">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            <XCircle className="h-8 w-8 text-red-400" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums">{uploadProgress.totalFailed}</p>
                                <p className="text-sm opacity-80">Failed / Duplicates</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800 border-white/10 text-white">
                        <CardContent className="pt-6 flex items-center space-x-4">
                            {!isComplete ? (
                                <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                            ) : (
                                <Upload className="h-8 w-8 text-blue-400" />
                            )}
                            <div>
                                <p className="text-2xl font-bold tabular-nums">{uploadProgress.processed} / {uploadProgress.total}</p>
                                <p className="text-sm opacity-80">Processed</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Record Feed */}
                <Card className="bg-slate-900 border-white/10 text-white overflow-hidden">
                    <CardHeader className="border-b border-white/10">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {!isComplete && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                            )}
                            Live Feed
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            Registrations being added in real time
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div ref={feedRef} className="max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-white/5 sticky top-0 z-10">
                                    <TableRow className="border-white/10">
                                        <TableHead className="text-gray-400 w-8">#</TableHead>
                                        <TableHead className="text-gray-400">Name</TableHead>
                                        <TableHead className="text-gray-400">Reg No</TableHead>
                                        <TableHead className="text-gray-400">Email</TableHead>
                                        <TableHead className="text-gray-400">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {uploadProgress.records.map((record, i) => (
                                        <TableRow
                                            key={i}
                                            className="border-white/10 record-enter"
                                            style={{ animationDelay: `${(i % 5) * 80}ms` }}
                                        >
                                            <TableCell className="text-gray-500 font-mono text-xs">{i + 1}</TableCell>
                                            <TableCell className="font-medium">{record.name}</TableCell>
                                            <TableCell className="text-gray-300 font-mono">{record.regNo}</TableCell>
                                            <TableCell className="text-gray-300 text-sm">{record.email}</TableCell>
                                            <TableCell>
                                                {record.status === 'success' ? (
                                                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        Added
                                                    </Badge>
                                                ) : record.status === 'duplicate' ? (
                                                    <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Duplicate
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 gap-1">
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
                                                <TableRow key={`skeleton-${i}`} className="border-white/10">
                                                    <TableCell colSpan={5}>
                                                        <div className="h-4 bg-white/5 rounded animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Completion Actions */}
                {isComplete && (
                    <div className="success-pop">
                        <Card className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border-green-500/20 text-white">
                            <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                        <CheckCircle className="h-6 w-6 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg">All registrations processed!</p>
                                        <p className="text-sm text-gray-400">
                                            {uploadProgress.totalInserted} added successfully
                                            {uploadProgress.totalFailed > 0 && `, ${uploadProgress.totalFailed} skipped`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={resetUpload} className="border-white/20 text-gray-300">
                                        Upload More
                                    </Button>
                                    <Link href={`/dashboard/events/${eventId}/registrations`}>
                                        <Button className="bg-green-600 hover:bg-green-700">
                                            View Registrations
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
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
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold text-white">Bulk Registration Upload</h2>
                    <p className="text-gray-400">Upload CSV or XLS files to register attendees in bulk.</p>
                </div>
            </div>

            {!previewData ? (
                <Card className="bg-slate-900 border-white/10 text-white">
                    <CardHeader>
                        <CardTitle>Select File</CardTitle>
                        <CardDescription className="text-gray-400">
                            Supported formats: .csv, .xls, .xlsx
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="border-2 border-dashed border-white/20 rounded-xl p-10 flex flex-col items-center justify-center space-y-4 hover:bg-white/5 transition-colors">
                            <Upload className="h-10 w-10 text-purple-400" />
                            <div className="text-center">
                                <p className="text-lg font-medium">Click to upload or drag and drop</p>
                                <p className="text-sm text-gray-500">CSV or Excel files only</p>
                            </div>
                            <Input
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="max-w-xs bg-white/10 border-white/20"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handlePreview}
                                disabled={!file || isPreviewing}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {isPreviewing ? 'Analyzing...' : 'Preview Data'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-green-500/10 border-green-500/20 text-green-100">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <CheckCircle className="h-8 w-8 text-green-400" />
                                <div>
                                    <p className="text-2xl font-bold">{previewData.stats.valid}</p>
                                    <p className="text-sm opacity-80">Valid Records</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/10 border-red-500/20 text-red-100">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <XCircle className="h-8 w-8 text-red-400" />
                                <div>
                                    <p className="text-2xl font-bold">{previewData.stats.rejected}</p>
                                    <p className="text-sm opacity-80">Rejected Records</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-800 border-white/10 text-white">
                            <CardContent className="pt-6 flex items-center space-x-4">
                                <Upload className="h-8 w-8 text-blue-400" />
                                <div>
                                    <p className="text-2xl font-bold">{previewData.stats.total}</p>
                                    <p className="text-sm opacity-80">Total Processed</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-slate-900 border-white/10 text-white overflow-hidden">
                        <Tabs defaultValue="valid" className="w-full">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <TabsList className="bg-white/5 border border-white/10">
                                    <TabsTrigger value="valid">Valid ({previewData.stats.valid})</TabsTrigger>
                                    <TabsTrigger value="rejected">Rejected ({previewData.stats.rejected})</TabsTrigger>
                                </TabsList>
                                <div className="space-x-2">
                                    <Button variant="outline" onClick={resetUpload} className="border-white/20 text-gray-300">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleConfirmUpload}
                                        disabled={previewData.stats.valid === 0 || isUploading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isUploading ? 'Uploading...' : 'Confirm & Upload'}
                                    </Button>
                                </div>
                            </div>

                            <TabsContent value="valid" className="m-0">
                                <div className="max-h-[500px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-white/5 sticky top-0">
                                            <TableRow className="border-white/10">
                                                <TableHead className="text-gray-400">Name</TableHead>
                                                <TableHead className="text-gray-400">Reg No</TableHead>
                                                <TableHead className="text-gray-400">Email</TableHead>
                                                <TableHead className="text-gray-400">Phone</TableHead>
                                                <TableHead className="text-gray-400">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.valid.map((row, i) => (
                                                <TableRow key={i} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-medium">{row.name}</TableCell>
                                                    <TableCell className="text-gray-300">{row.regNo}</TableCell>
                                                    <TableCell className="text-gray-300">{row.email}</TableCell>
                                                    <TableCell className="text-gray-300">{row.phone}</TableCell>
                                                    <TableCell>
                                                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
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
                                        <TableHeader className="bg-white/5 sticky top-0">
                                            <TableRow className="border-white/10">
                                                <TableHead className="text-gray-400">Name</TableHead>
                                                <TableHead className="text-gray-400">Email</TableHead>
                                                <TableHead className="text-gray-400">Reason</TableHead>
                                                <TableHead className="text-gray-400">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.rejected.map((row, i) => (
                                                <TableRow key={i} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-medium text-gray-400">{row.name}</TableCell>
                                                    <TableCell className="text-gray-500">{row.email}</TableCell>
                                                    <TableCell className="text-red-400">{row.reason}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-red-400 border-red-500/30">
                                                            Rejected
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {previewData.stats.rejected === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                        No rejected records
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div>
            )}
        </div>
    );
}
