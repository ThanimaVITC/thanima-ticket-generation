import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from './jwt';
import connectDB from '@/lib/db/connection';
import Account from '@/lib/db/models/account';

export async function getAuthUser(): Promise<JWTPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
        return null;
    }

    return verifyToken(token);
}

export async function requireAuth(
    handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const user = await getAuthUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Verify user still exists in database
        await connectDB();
        const account = await Account.findById(user.userId);

        if (!account) {
            return NextResponse.json(
                { error: 'Account not found' },
                { status: 401 }
            );
        }

        return handler(req, user);
    };
}

export function withAuth(
    handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const user = await getAuthUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        return handler(req, user);
    };
}
