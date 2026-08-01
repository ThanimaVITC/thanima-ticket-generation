import mongoose, { Schema, Document, Model } from 'mongoose';

// One row per *stay*, not per person. A user can enter, be removed, and enter
// again — each of those is its own document. "Currently in the pool" is simply
// exitedAt === null, which is also what the two unique partial indexes key on,
// so there is no separate history collection.
export interface IUserPoolEntry extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    registrationId: mongoose.Types.ObjectId;
    email: string;
    regNo: string;
    name: string;
    phone: string;
    nfcId: string; // Normalized card UID: uppercase hex, no separators
    enteredAt: Date;
    exitedAt: Date | null;
    addedBy?: mongoose.Types.ObjectId | null;
    removedBy?: mongoose.Types.ObjectId | null;
}

const UserPoolEntrySchema = new Schema<IUserPoolEntry>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        registrationId: {
            type: Schema.Types.ObjectId,
            ref: 'EventRegistration',
            required: [true, 'Registration ID is required'],
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
        phone: {
            type: String,
            default: '',
            trim: true,
        },
        nfcId: {
            type: String,
            required: [true, 'Card ID is required'],
            uppercase: true,
            trim: true,
        },
        enteredAt: {
            type: Date,
            default: Date.now,
        },
        exitedAt: {
            type: Date,
            default: null,
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
        removedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
    },
    {
        timestamps: false,
    }
);

// Active-stay uniqueness. The partial filter is what allows re-entry: once
// exitedAt is a Date the row drops out of the index, freeing both the person
// and their card for a fresh entry.
// ponytail: if a driver ever rejects `{exitedAt: null}` in a partial filter,
// swap it for `{exitedAt: {$type: 'null'}}` — the schema always writes an
// explicit null, so the two are equivalent here.
UserPoolEntrySchema.index(
    { eventId: 1, email: 1 },
    { unique: true, partialFilterExpression: { exitedAt: null } }
);
UserPoolEntrySchema.index(
    { eventId: 1, nfcId: 1 },
    { unique: true, partialFilterExpression: { exitedAt: null } }
);
UserPoolEntrySchema.index({ eventId: 1, enteredAt: -1 });

const UserPoolEntry: Model<IUserPoolEntry> =
    mongoose.models.UserPoolEntry ||
    mongoose.model<IUserPoolEntry>('UserPoolEntry', UserPoolEntrySchema);

export default UserPoolEntry;
