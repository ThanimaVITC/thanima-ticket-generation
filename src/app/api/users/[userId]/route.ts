import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Account from '@/lib/db/models/account';
import { getAuthUser } from '@/lib/auth/middleware';

// PUT /api/users/[userId] - Update user
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }

        const body = await req.json();
        const { name, email, password } = body;

        if (!name && !email && !password) {
            return NextResponse.json(
                { error: 'At least one field (name, email, or password) is required' },
                { status: 400 }
            );
        }

        await connectDB();

        const user = await Account.findById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if email is being changed and if it's already taken
        if (email && email.toLowerCase() !== user.email) {
            const existingEmail = await Account.findOne({ email: email.toLowerCase() });
            if (existingEmail) {
                return NextResponse.json(
                    { error: 'Email already in use' },
                    { status: 409 }
                );
            }
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (password) {
            if (password.length < 6) {
                return NextResponse.json(
                    { error: 'Password must be at least 6 characters' },
                    { status: 400 }
                );
            }
            user.passwordHash = await bcrypt.hash(password, 10);
        }

        await user.save();

        return NextResponse.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            message: 'User updated successfully',
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[userId] - Delete user
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }

        // Prevent self-deletion
        if (authUser.userId === userId) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 403 }
            );
        }

        await connectDB();

        const user = await Account.findByIdAndDelete(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 }
        );
    }
}
