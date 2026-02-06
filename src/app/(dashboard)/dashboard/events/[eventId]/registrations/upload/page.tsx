'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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

export default function BulkUploadPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = use(params);
    const router = useRouter();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

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
        try {
            const res = await fetch('/api/registrations/bulk-create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventId,
                    registrations: previewData.valid,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            toast({
                title: 'Upload Successful',
                description: `${result.count} registrations added successfully.`,
            });

            router.push(`/dashboard/events/${eventId}/registrations`);
        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    }

    const resetUpload = () => {
        setFile(null);
        setPreviewData(null);
    };

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
