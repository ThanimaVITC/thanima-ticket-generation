import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import FoodSession from '@/lib/db/models/foodSession';
import FoodAssignment from '@/lib/db/models/foodAssignment';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { describeFoodColor } from '@/lib/food-colors';
import { describeSessionTiming } from '@/lib/food-session-stats';
import { sendPlainEmail } from '@/lib/email';
import {
    renderEmailTemplate,
    buildFoodColorEmailHtml,
    withFoodEmailDefaults,
} from '@/lib/email-templates';
import { format } from 'date-fns';

// Vercel kills a function at maxDuration regardless of whether it is streaming, and the
// platform default is 10-15s — far too short for a mail run. 60 is the highest value
// valid on every plan; Pro with Fluid Compute can raise this to 300.
export const maxDuration = 60;

// POST /api/food-emails/send
// Mails the "you're checked in, your colour is X" note to attendees holding a food slot.
// Mirrors /api/emails/send: an SSE stream, an invocation cap on Vercel, and resumability
// carried by emailStatus on the row rather than by the request.
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return json({ error: 'Unauthorized' }, 401);
        }

        const body = await req.json();
        const {
            eventId,
            assignmentIds,
            count,
            sessionId,
            resend = false,
            batchSize = 5,
            delayMs = 1000,
            emailSubject,
            emailBody,
        } = body;

        // Food mail is cheap next to a ticket: no S3 fetch, no canvas render, no
        // attachment. So the invocation cap is higher than the ticket route's 100 —
        // what bounds it here is SMTP throughput, not compute.
        const vercelHosting = process.env.HOSTING_VERCEL?.toLowerCase() === 'true';
        const VERCEL_MAX_EMAILS_PER_BATCH = 150;

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return json({ error: 'Valid eventId is required' }, 400);
        }

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const event = await Event.findById(eventId).select('title date foodSessionsEnabled foodEmailTemplate').lean();
        if (!event) {
            return json({ error: 'Event not found' }, 404);
        }
        if (!event.foodSessionsEnabled) {
            return json({ error: 'Food sessions are not enabled for this event' }, 400);
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        // Colour and timing come from the session, so resolve them once for the whole run
        // rather than per recipient.
        const sessions = await FoodSession.find({ eventId: eventObjectId }).lean();
        const sessionById = new Map(
            sessions.map((s) => [
                s._id.toString(),
                {
                    ...describeFoodColor(s.color),
                    timing: describeSessionTiming(s.startTime, s.endTime),
                },
            ])
        );

        const query: Record<string, unknown> = { eventId: eventObjectId };
        if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
            query.foodSessionId = new mongoose.Types.ObjectId(sessionId);
        }

        if (assignmentIds && Array.isArray(assignmentIds) && assignmentIds.length > 0) {
            // An explicit selection is always honoured, sent or not.
            query._id = { $in: assignmentIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
        } else if (!resend) {
            query.emailStatus = { $ne: 'sent' };
        }

        let assignments = count && !assignmentIds
            ? await FoodAssignment.find(query).limit(Number(count))
            : await FoodAssignment.find(query);

        if (assignments.length === 0) {
            return json({ error: 'No food slots found to email' }, 400);
        }

        const matchedCount = assignments.length;
        let capped = false;
        if (vercelHosting && assignments.length > VERCEL_MAX_EMAILS_PER_BATCH) {
            assignments = assignments.slice(0, VERCEL_MAX_EMAILS_PER_BATCH);
            capped = true;
        }

        // Defaults fill any field a saved template predates, so an event created before
        // the heading/footer fields existed still mails something sensible.
        const template = withFoodEmailDefaults({
            ...event.foodEmailTemplate,
            ...(emailSubject ? { subject: emailSubject } : {}),
            ...(emailBody ? { body: emailBody } : {}),
        });

        const effectiveBatchSize = Math.max(1, Math.min(20, Number(batchSize)));
        // Pacing comes from the caller as a rate (emails/sec) turned into a gap.
        const effectiveDelay = Math.max(0, Math.min(10000, Number(delayMs) || 0));

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const total = assignments.length;
                let sent = 0;
                let failed = 0;
                let processed = 0;

                const emit = (payload: unknown) =>
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

                try {
                    for (let i = 0; i < total; i += effectiveBatchSize) {
                        // Stop is a client disconnect — checked between batches only, so the
                        // email in flight finishes and is recorded first.
                        if (req.signal.aborted) break;

                        const batch = assignments.slice(i, i + effectiveBatchSize);
                        const records: unknown[] = [];

                        for (const a of batch) {
                            const session = sessionById.get(a.foodSessionId.toString());
                            try {
                                if (!session) {
                                    throw new Error('Food session no longer exists');
                                }

                                const vars: Record<string, string> = {
                                    name: a.name,
                                    regNo: a.regNo,
                                    eventTitle: event.title,
                                    date: format(new Date(event.date), 'PPP'),
                                    color: session.colorName,
                                    timing: session.timing,
                                };

                                await sendPlainEmail({
                                    to: a.email,
                                    subject: renderEmailTemplate(template.subject, vars),
                                    html: buildFoodColorEmailHtml({
                                        template,
                                        variables: vars,
                                        colorName: session.colorName,
                                        colorHex: session.colorHex,
                                    }),
                                });

                                await FoodAssignment.findByIdAndUpdate(a._id, {
                                    emailStatus: 'sent',
                                    emailSentAt: new Date(),
                                });

                                sent++;
                                records.push({
                                    name: a.name,
                                    regNo: a.regNo,
                                    email: a.email,
                                    color: session.colorName,
                                    status: 'sent',
                                });
                            } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : 'Send failed';
                                console.error(`Failed to send food email to ${a.email}:`, message);

                                await FoodAssignment.findByIdAndUpdate(a._id, { emailStatus: 'failed' });

                                failed++;
                                records.push({
                                    name: a.name,
                                    regNo: a.regNo,
                                    email: a.email,
                                    color: session?.colorName ?? '',
                                    status: 'failed',
                                    error: message,
                                });
                            }
                        }

                        processed += batch.length;
                        emit({ type: 'progress', data: { processed, total, sent, failed, records } });

                        if (i + effectiveBatchSize < total) {
                            await new Promise((resolve) => setTimeout(resolve, effectiveDelay));
                        }
                    }

                    if (req.signal.aborted) return;
                    emit({
                        type: 'complete',
                        data: {
                            sent,
                            failed,
                            total,
                            capped,
                            batchLimit: capped ? VERCEL_MAX_EMAILS_PER_BATCH : undefined,
                            remaining: capped ? matchedCount - total : 0,
                        },
                    });
                } catch (error) {
                    console.error('Food email stream error:', error);
                    if (req.signal.aborted) return;
                    emit({ type: 'error', data: { message: 'Failed to process the email batch' } });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Food email send error:', error);
        return json({ error: 'Failed to send food emails' }, 500);
    }
}

function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
