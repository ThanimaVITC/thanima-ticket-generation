import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFoodSession extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    name: string;
    limit: number; // Soft warning threshold
    maxLimit: number; // Hard capacity cap
    isVisible: boolean;
    count: number; // Denormalized admitted count, updated via atomic $inc
    createdAt: Date;
}

const FoodSessionSchema = new Schema<IFoodSession>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        name: {
            type: String,
            required: [true, 'Session name is required'],
            trim: true,
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
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

FoodSessionSchema.index({ eventId: 1 });
FoodSessionSchema.index({ eventId: 1, isVisible: 1 });

const FoodSession: Model<IFoodSession> =
    mongoose.models.FoodSession ||
    mongoose.model<IFoodSession>('FoodSession', FoodSessionSchema);

export default FoodSession;
