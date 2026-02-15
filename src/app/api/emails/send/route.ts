import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';
import { generateQRHash } from '@/lib/crypto';
import { generateTicketImage } from '@/lib/ticket-generator';
import { sendTicketEmail, renderEmailTemplate, buildEmailHtml } from '@/lib/email';
import { format } from 'date-fns';

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
        const { eventId, registrationIds, count, batchSize = 5, delayMs = 1000, emailSubject, emailBody } = body;

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return new Response(
                JSON.stringify({ error: 'Valid eventId is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return new Response(
                JSON.stringify({ error: 'Event not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!event.ticketTemplate?.imagePath) {
            return new Response(
                JSON.stringify({ error: 'Event has no ticket template configured. Please set up a ticket template first.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Determine which registrations to send to
        let query: any = { eventId: new mongoose.Types.ObjectId(eventId) };

        if (registrationIds && Array.isArray(registrationIds) && registrationIds.length > 0) {
            // Specific registrations
            query._id = { $in: registrationIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
        } else if (!count) {
            // All pending (not yet sent)
            query.emailStatus = { $ne: 'sent' };
        }

        let registrations;
        if (count && !registrationIds) {
            // Next N unsent
            registrations = await EventRegistration.find({
                ...query,
                emailStatus: { $ne: 'sent' },
            }).limit(Number(count));
        } else {
            registrations = await EventRegistration.find(query);
        }

        if (registrations.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No registrations found to send emails to' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Use provided subject/body or fall back to event's saved template
        const subjectTemplate = emailSubject || event.emailTemplate?.subject || 'Your Ticket for {{eventTitle}}';
        const bodyTemplate = emailBody || event.emailTemplate?.body || 'Hi {{name}},\n\nHere is your ticket for {{eventTitle}}.\n\nPlease present the QR code at the event for entry.';

        const effectiveBatchSize = Math.max(1, Math.min(20, Number(batchSize)));
        const effectiveDelay = Math.max(500, Math.min(5000, Number(delayMs)));

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const total = registrations.length;
                let sent = 0;
                let failed = 0;
                let processed = 0;

                try {
                    for (let i = 0; i < total; i += effectiveBatchSize) {
                        const batch = registrations.slice(i, i + effectiveBatchSize);
                        const processedRecords: any[] = [];

                        for (const reg of batch) {
                            try {
                                // Generate QR hash if not already set
                                let qrPayload = reg.qrPayload;
                                if (!qrPayload) {
                                    qrPayload = generateQRHash(eventId, reg.email);
                                    await EventRegistration.findByIdAndUpdate(reg._id, { qrPayload });
                                }

                                // Generate ticket image
                                const ticketBuffer = await generateTicketImage({
                                    templateImagePath: event.ticketTemplate!.imagePath!,
                                    qrPayload,
                                    name: reg.name,
                                    regNo: reg.regNo,
                                    qrPosition: event.ticketTemplate!.qrPosition,
                                    namePosition: event.ticketTemplate!.namePosition,
                                    regNoPosition: event.ticketTemplate!.regNoPosition,
                                    qrLogoPath: event.ticketTemplate!.qrLogoPath,
                                    rotateTicket: event.ticketTemplate!.rotateTicket,
                                });

                                // Render email template
                                const templateVars: Record<string, string> = {
                                    name: reg.name,
                                    eventTitle: event.title,
                                    regNo: reg.regNo,
                                    date: format(new Date(event.date), 'PPP'),
                                };

                                const subject = renderEmailTemplate(subjectTemplate, templateVars);
                                const html = buildEmailHtml(bodyTemplate, templateVars);

                                // Send email
                                await sendTicketEmail({
                                    to: reg.email,
                                    subject,
                                    html,
                                    ticketBuffer,
                                    studentName: reg.name,
                                });

                                // Update registration status
                                await EventRegistration.findByIdAndUpdate(reg._id, {
                                    emailSentAt: new Date(),
                                    emailStatus: 'sent',
                                });

                                sent++;
                                processedRecords.push({
                                    name: reg.name,
                                    regNo: reg.regNo,
                                    email: reg.email,
                                    status: 'sent',
                                });
                            } catch (error: any) {
                                console.error(`Failed to send email to ${reg.email}:`, error.message);

                                // Mark as failed
                                await EventRegistration.findByIdAndUpdate(reg._id, {
                                    emailStatus: 'failed',
                                });

                                failed++;
                                processedRecords.push({
                                    name: reg.name,
                                    regNo: reg.regNo,
                                    email: reg.email,
                                    status: 'failed',
                                    error: error.message,
                                });
                            }
                        }

                        processed += batch.length;

                        // Send progress event
                        const progressEvent = {
                            type: 'progress',
                            data: {
                                processed,
                                total,
                                sent,
                                failed,
                                records: processedRecords,
                            },
                        };

                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`)
                        );

                        // Delay between batches
                        if (i + effectiveBatchSize < total) {
                            await new Promise(resolve => setTimeout(resolve, effectiveDelay));
                        }
                    }

                    // Send completion event
                    const completeEvent = {
                        type: 'complete',
                        data: { sent, failed, total },
                    };

                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`)
                    );
                } catch (error) {
                    console.error('Email send stream error:', error);
                    const errorEvent = {
                        type: 'error',
                        data: { message: 'Failed to process email batch' },
                    };
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
                    );
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Email send error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to send emails' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
