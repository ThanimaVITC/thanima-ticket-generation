import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import { signPublicToken } from '@/lib/auth/public-jwt';

// POST /api/public/auth/login - Login with email + phone for a specific event
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, email, phone } = body;

        if (!eventId || !email || !phone) {
            return NextResponse.json(
                { error: 'Event ID, email, and phone are required' },
                { status: 400 }
            );
        }

        await connectDB();

        // Find registration matching email and phone for this event
        const registration = await EventRegistration.findOne({
            eventId,
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
        }).lean();

        if (!registration) {
            return NextResponse.json(
                { error: 'No registration found with these details for this event' },
                { status: 404 }
            );
        }

        // Generate JWT token
        const token = signPublicToken({
            eventId: eventId,
            regNo: registration.regNo,
            email: registration.email,
            name: registration.name,
            phone: registration.phone,
        });

        // Set cookie
        const response = NextResponse.json({
            success: true,
            user: {
                name: registration.name,
                email: registration.email,
                regNo: registration.regNo,
            },
        });

        response.cookies.set('public-auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Public login error:', error);
        return NextResponse.json(
            { error: 'Login failed' },
            { status: 500 }
        );
    }
}
