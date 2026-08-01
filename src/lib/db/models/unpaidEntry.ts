import mongoose, { Schema, Document, Model } from 'mongoose';

// People who turned up without paying. Deliberately its OWN collection, keyed
// by eventId — never merged into EventRegistration. Unpaid attendees are
// filtered out at CSV import (see api/registrations/preview), so they have no
// registration row and no email; a free-form name + regNo is all there is.
export interface IUnpaidEntry extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    name: string;
    regNo: string;
    source: 'manual' | 'ocr';
    addedBy?: mongoose.Types.ObjectId | null;
    createdAt: Date;
}

const UnpaidEntrySchema = new Schema<IUnpaidEntry>(
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
            uppercase: true,
            trim: true,
        },
        source: {
            type: String,
            enum: ['manual', 'ocr'],
            default: 'manual',
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// One row per person per event — a second scan of the same card is a no-op,
// not a duplicate line on the list.
UnpaidEntrySchema.index({ eventId: 1, regNo: 1 }, { unique: true });
UnpaidEntrySchema.index({ eventId: 1, createdAt: -1 });

const UnpaidEntry: Model<IUnpaidEntry> =
    mongoose.models.UnpaidEntry ||
    mongoose.model<IUnpaidEntry>('UnpaidEntry', UnpaidEntrySchema);

export default UnpaidEntry;
