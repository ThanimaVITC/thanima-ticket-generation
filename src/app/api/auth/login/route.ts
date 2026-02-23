import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Account from '@/lib/db/models/account';
import { signToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        await connectDB();

        const account = await Account.findOne({ email: email.toLowerCase() });

        if (!account) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(password, account.passwordHash);

        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const token = signToken({
            userId: account._id.toString(),
            email: account.email,
            role: account.role,
            assignedEvents: (account.assignedEvents || []).map((id: { toString: () => string }) => id.toString()),
        });

        // Set HTTP-only cookie
        const cookieStore = await cookies();
        cookieStore.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return NextResponse.json({
            message: 'Login successful',
            token, // Return token for mobile clients
            user: {
                id: account._id,
                name: account.name,
                email: account.email,
                role: account.role,
                assignedEvents: account.assignedEvents || [],
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
