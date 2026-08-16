import mongoose, { Schema, Document, Model } from 'mongoose';
import { FOOD_COLOR_KEYS } from '@/lib/food-colors';

export interface IFoodSession extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    color: string; // Palette key from FOOD_COLORS — this is the session's identity
    limit: number; // Soft warning threshold
    maxLimit: number; // Hard capacity cap
    isVisible: boolean;
    count: number; // Denormalized *assigned* count, updated via atomic $inc at the door
    // Optional sitting time, "HH:MM" 24h as produced by <input type="time">. Purely a
    // label: shown on the dashboard and in the mail, never used to gate a scan.
    startTime?: string;
    endTime?: string;
    createdAt: Date;
}

const FoodSessionSchema = new Schema<IFoodSession>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        color: {
            type: String,
            required: [true, 'Session colour is required'],
            enum: FOOD_COLOR_KEYS,
        },
        limit: {
            type: Number,
            required: [true, 'Limit is required'],
            min: [0, 'Limit cannot be negative'],
        },
        maxLimit: {
            type: Number,
            required: [true, 'Max limit is required'],
            min: [1, 'Max limit must be at least 1'],
        },
        isVisible: {
            type: Boolean,
            default: true,
        },
        count: {
            type: Number,
            default: 0,
            min: 0,
        },
        startTime: {
            type: String,
            default: '',
            trim: true,
        },
        endTime: {
            type: String,
            default: '',
            trim: true,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

FoodSessionSchema.index({ eventId: 1 });
FoodSessionSchema.index({ eventId: 1, isVisible: 1 });
// A colour identifies the session, so it can back at most one session per event.
FoodSessionSchema.index({ eventId: 1, color: 1 }, { unique: true });

const FoodSession: Model<IFoodSession> =
    mongoose.models.FoodSession ||
    mongoose.model<IFoodSession>('FoodSession', FoodSessionSchema);

export default FoodSession;
