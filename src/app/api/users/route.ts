import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Account from '@/lib/db/models/account';
import { getAuthUser, requireRole } from '@/lib/auth/middleware';

// GET /api/users - List all users
export async function GET() {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCheck = requireRole(user, 'admin');
        if (roleCheck) return roleCheck;

        await connectDB();

        const users = await Account.find()
            .select('-passwordHash')
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

// POST /api/users - Create new user
export async function POST(req: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCheck = requireRole(authUser, 'admin');
        if (roleCheck) return roleCheck;

        const body = await req.json();
        const { name, email, password, role, assignedEvents } = body;

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email, and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        await connectDB();

        // Check if email already exists
        const existing = await Account.findOne({ email: email.toLowerCase() });
        if (existing) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const account = await Account.create({
            name,
            email: email.toLowerCase(),
            passwordHash,
            role: role || 'admin',
            assignedEvents: assignedEvents || [],
        });

        return NextResponse.json(
            {
                user: {
                    id: account._id,
                    name: account.name,
                    email: account.email,
                },
                message: 'User created successfully',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        );
    }
}
