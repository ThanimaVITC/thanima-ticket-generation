import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Account, { AccountRole } from '@/lib/db/models/account';
import { getAuthUser, requireRole, callerEventIds } from '@/lib/auth/middleware';

// GET /api/users - List users (admins see all; event_admins see app_users and
// event_admins within their assigned events)
export async function GET() {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;

        await connectDB();

        // Admins see everyone. Event admins only see app_users and event_admins
        // that share at least one of their assigned events.
        const filter: Record<string, unknown> =
            user.role === 'admin'
                ? {}
                : {
                      role: { $in: ['app_user', 'event_admin'] },
                      assignedEvents: { $in: callerEventIds(user) },
                  };

        const users = await Account.find(filter)
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

        const roleCheck = requireRole(authUser, 'admin', 'event_admin');
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

        // Resolve role + events based on who is creating the account.
        let finalRole: AccountRole;
        let finalAssignedEvents: string[];

        if (authUser.role === 'event_admin') {
            // Event admins may only create app_users, and only for events they manage.
            finalRole = 'app_user';
            const scope = new Set(callerEventIds(authUser));
            finalAssignedEvents = (Array.isArray(assignedEvents) ? assignedEvents : [])
                .map((e: string) => String(e))
                .filter((e: string) => scope.has(e));
            if (finalAssignedEvents.length === 0) {
                return NextResponse.json(
                    { error: 'Select at least one of your assigned events for this app user' },
                    { status: 400 }
                );
            }
        } else {
            finalRole = (role as AccountRole) || 'admin';
            finalAssignedEvents = Array.isArray(assignedEvents) ? assignedEvents : [];
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
            role: finalRole,
            assignedEvents: finalAssignedEvents,
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
