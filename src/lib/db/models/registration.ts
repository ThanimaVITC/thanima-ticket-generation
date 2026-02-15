import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEventRegistration extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    name: string;
    regNo: string;
    email: string;
    phone: string;
    downloadCount: number;
    qrPayload?: string | null; // Encrypted QR payload, generated once and reused
    rateLimitWindowStart?: Date;
    rateLimitCount?: number;
    emailSentAt?: Date | null;
    emailStatus?: 'pending' | 'sent' | 'failed';
    createdAt: Date;
}

const EventRegistrationSchema = new Schema<IEventRegistration>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        regNo: {
            type: String,
            required: [true, 'Registration number is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        downloadCount: {
            type: Number,
            default: 0,
        },
        qrPayload: {
            type: String,
            default: null,
        },
        rateLimitWindowStart: {
            type: Date,
            default: Date.now,
        },
        rateLimitCount: {
            type: Number,
            default: 0,
        },
        emailSentAt: {
            type: Date,
            default: null,
        },
        emailStatus: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending',
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// Compound unique index to prevent duplicate registrations
EventRegistrationSchema.index({ eventId: 1, email: 1 }, { unique: true });
EventRegistrationSchema.index({ eventId: 1, regNo: 1 }, { unique: true });

// Individual indexes for efficient queries
EventRegistrationSchema.index({ eventId: 1 });
EventRegistrationSchema.index({ email: 1 });
EventRegistrationSchema.index({ regNo: 1 });
EventRegistrationSchema.index({ phone: 1 });

const EventRegistration: Model<IEventRegistration> =
    mongoose.models.EventRegistration ||
    mongoose.model<IEventRegistration>('EventRegistration', EventRegistrationSchema);

export default EventRegistration;
