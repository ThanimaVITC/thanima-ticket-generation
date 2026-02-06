import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST /api/public/auth/logout - Logout public user
export async function POST() {
    try {
        const cookieStore = await cookies();

        const response = NextResponse.json({ success: true });

        // Delete the public auth cookie
        response.cookies.set('public-auth-token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Public logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
