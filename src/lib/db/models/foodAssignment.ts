import mongoose, { Schema, Document, Model } from 'mongoose';

// An attendee's food slot. Created at the door the moment they are marked present —
// that is when a seat is consumed. `servedAt` is stamped later at the food counter.
export interface IFoodAssignment extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    foodSessionId: mongoose.Types.ObjectId;
    email: string;
    regNo: string;
    name: string;
    assignedBy?: mongoose.Types.ObjectId | null;
    assignedAt: Date;
    servedBy?: mongoose.Types.ObjectId | null;
    servedAt?: Date | null;
    // Mirrors EventRegistration.emailStatus: the queue state that makes a send
    // resumable. Work is selected by {$ne: 'sent'}, so re-triggering picks up where
    // an interrupted run stopped.
    emailStatus?: 'pending' | 'sent' | 'failed';
    emailSentAt?: Date | null;
}

const FoodAssignmentSchema = new Schema<IFoodAssignment>(
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
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
        assignedAt: {
            type: Date,
            default: Date.now,
        },
        servedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
        servedAt: {
            type: Date,
            default: null,
        },
        emailStatus: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending',
        },
        emailSentAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: false,
    }
);

// One slot per person per event. Also the race guard behind the atomic reserve.
FoodAssignmentSchema.index({ eventId: 1, email: 1 }, { unique: true });
FoodAssignmentSchema.index({ foodSessionId: 1 });
FoodAssignmentSchema.index({ eventId: 1 });

const FoodAssignment: Model<IFoodAssignment> =
    mongoose.models.FoodAssignment ||
    mongoose.model<IFoodAssignment>('FoodAssignment', FoodAssignmentSchema);

export default FoodAssignment;
