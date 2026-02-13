import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

const BATCH_SIZE = 5;

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();
        const { eventId, registrations } = body;

        if (!eventId || !registrations || !Array.isArray(registrations)) {
            return new Response(
                JSON.stringify({ error: 'Invalid payload' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (registrations.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No registrations to insert' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        await connectDB();

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const totalRegistrations = registrations.length;
                let totalInserted = 0;
                let totalFailed = 0;
                let processedSoFar = 0;

                try {
                    // Process in batches
                    for (let i = 0; i < totalRegistrations; i += BATCH_SIZE) {
                        const batch = registrations.slice(i, i + BATCH_SIZE);

                        // Prepare batch - qrPayload will be null, assigned later via mobile app
                        const batchToInsert = batch.map((reg: any) => ({
                            eventId: new mongoose.Types.ObjectId(eventId),
                            name: reg.name,
                            regNo: reg.regNo,
                            email: reg.email,
                            phone: reg.phone,
                            qrPayload: null,
                            source: 'bulk_upload',
                            createdAt: new Date(),
                            attended: false
                        }));

                        // Insert this batch
                        let batchInserted = 0;
                        let batchFailed = 0;
                        const processedRecords: any[] = [];

                        try {
                            const result = await EventRegistration.insertMany(batchToInsert, {
                                ordered: false
                            });
                            batchInserted = result.length;
                            batchFailed = batch.length - batchInserted;

                            // Mark all as inserted
                            for (const reg of batch) {
                                processedRecords.push({
                                    name: reg.name,
                                    regNo: reg.regNo,
                                    email: reg.email,
                                    phone: reg.phone,
                                    status: 'success'
                                });
                            }
                        } catch (error: any) {
                            if (error.code === 11000) {
                                // Some duplicates in this batch
                                batchInserted = error.insertedDocs?.length || 0;
                                batchFailed = batch.length - batchInserted;

                                const insertedEmails = new Set(
                                    (error.insertedDocs || []).map((d: any) => d.email)
                                );

                                for (const reg of batch) {
                                    processedRecords.push({
                                        name: reg.name,
                                        regNo: reg.regNo,
                                        email: reg.email,
                                        phone: reg.phone,
                                        status: insertedEmails.has(reg.email) ? 'success' : 'duplicate'
                                    });
                                }
                            } else {
                                // Unexpected error for this batch
                                batchFailed = batch.length;
                                for (const reg of batch) {
                                    processedRecords.push({
                                        name: reg.name,
                                        regNo: reg.regNo,
                                        email: reg.email,
                                        phone: reg.phone,
                                        status: 'failed'
                                    });
                                }
                            }
                        }

                        totalInserted += batchInserted;
                        totalFailed += batchFailed;
                        processedSoFar += batch.length;

                        // Send progress event
                        const progressEvent = {
                            type: 'progress',
                            data: {
                                processed: processedSoFar,
                                total: totalRegistrations,
                                batchInserted,
                                batchFailed,
                                records: processedRecords,
                                totalInserted,
                                totalFailed,
                            }
                        };

                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`)
                        );

                        // Small delay between batches for visual effect
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }

                    // Send completion event
                    const completeEvent = {
                        type: 'complete',
                        data: {
                            totalInserted,
                            totalFailed,
                            total: totalRegistrations,
                        }
                    };

                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`)
                    );
                } catch (error) {
                    const errorEvent = {
                        type: 'error',
                        data: { message: 'Failed to process registrations' }
                    };
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
                    );
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Batch upload error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to process registrations' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
