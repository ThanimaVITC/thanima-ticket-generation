import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFoodScan extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    foodSessionId: mongoose.Types.ObjectId;
    email: string;
    regNo: string;
    name: string;
    scannedBy?: mongoose.Types.ObjectId | null;
    scannedAt: Date;
}

const FoodScanSchema = new Schema<IFoodScan>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        foodSessionId: {
            type: Schema.Types.ObjectId,
            ref: 'FoodSession',
            required: [true, 'Food session ID is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        regNo: {
            type: String,
            default: '',
            trim: true,
        },
        name: {
            type: String,
            default: '',
            trim: true,
        },
        scannedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
        scannedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
    }
);

// Enforces "once per event" — an attendee can only be admitted to food once per event
FoodScanSchema.index({ eventId: 1, email: 1 }, { unique: true });
FoodScanSchema.index({ foodSessionId: 1 });
FoodScanSchema.index({ eventId: 1 });

const FoodScan: Model<IFoodScan> =
    mongoose.models.FoodScan ||
    mongoose.model<IFoodScan>('FoodScan', FoodScanSchema);

export default FoodScan;
