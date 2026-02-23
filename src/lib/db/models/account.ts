import mongoose, { Schema, Document, Model } from 'mongoose';

export type AccountRole = 'admin' | 'event_admin' | 'app_user';

export interface IAccount extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    passwordHash: string;
    role: AccountRole;
    assignedEvents: mongoose.Types.ObjectId[];
    createdAt: Date;
}

const AccountSchema = new Schema<IAccount>(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
        },
        role: {
            type: String,
            enum: ['admin', 'event_admin', 'app_user'],
            default: 'admin',
        },
        assignedEvents: [{
            type: Schema.Types.ObjectId,
            ref: 'Event',
        }],
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// Note: unique: true on email field already creates an index

const Account: Model<IAccount> =
    mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema);

export default Account;

