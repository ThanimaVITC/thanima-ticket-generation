import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';

// GET /api/health - Health check endpoint
export async function GET() {
    try {
        await connectDB();

        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    } catch (error) {
        console.error('Health check failed:', error);
        return NextResponse.json(
            {
                status: 'error',
                timestamp: new Date().toISOString(),
                database: 'disconnected',
            },
            { status: 503 }
        );
    }
}
