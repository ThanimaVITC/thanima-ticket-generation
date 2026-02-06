import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyPublicToken } from '@/lib/auth/public-jwt';

// GET /api/public/auth/me - Get current logged-in public user
export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('public-auth-token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const user = verifyPublicToken(token);
        if (!user) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            user: {
                eventId: user.eventId,
                name: user.name,
                email: user.email,
                regNo: user.regNo,
                phone: user.phone,
            },
        });
    } catch (error) {
        console.error('Public auth check error:', error);
        return NextResponse.json(
            { error: 'Authentication check failed' },
            { status: 500 }
        );
    }
}
