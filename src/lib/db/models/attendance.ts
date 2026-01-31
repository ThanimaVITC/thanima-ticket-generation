import mongoose, { Schema, Document, Model } from 'mongoose';

export type AttendanceSource = 'web' | 'mobile';

export interface IAttendance extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    email: string;
    markedAt: Date;
    source: AttendanceSource;
}

const AttendanceSchema = new Schema<IAttendance>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        markedAt: {
            type: Date,
            default: Date.now,
        },
        source: {
            type: String,
            enum: ['web', 'mobile'],
            required: [true, 'Source is required'],
        },
    },
    {
        timestamps: false,
    }
);

// Compound unique index to prevent duplicate attendance
AttendanceSchema.index({ eventId: 1, email: 1 }, { unique: true });

// Individual indexes for efficient queries
AttendanceSchema.index({ eventId: 1 });
AttendanceSchema.index({ email: 1 });

const Attendance: Model<IAttendance> =
    mongoose.models.Attendance ||
    mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
