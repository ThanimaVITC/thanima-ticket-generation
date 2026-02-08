import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITicketTemplate {
    imagePath?: string;
    qrLogoPath?: string;
    qrPosition?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    namePosition?: {
        x: number;
        y: number;
        fontSize: number;
        color: string;
        fontFamily?: string;
    };
    regNoPosition?: {
        x: number;
        y: number;
        fontSize: number;
        color: string;
        fontFamily?: string;
    };
}

export interface IEvent extends Document {
    _id: mongoose.Types.ObjectId;
    title: string;
    description: string;
    date: Date;
    isPublicDownload: boolean;
    isActiveDisplay: boolean;
    ticketTemplate?: ITicketTemplate;
    createdAt: Date;
}

const EventSchema = new Schema<IEvent>(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Event date is required'],
        },
        isPublicDownload: {
            type: Boolean,
            default: false,
        },
        isActiveDisplay: {
            type: Boolean,
            default: false,
        },
        ticketTemplate: {
            imagePath: String,
            qrLogoPath: String,
            qrPosition: {
                x: Number,
                y: Number,
                width: Number,
                height: Number,
            },
            namePosition: {
                x: Number,
                y: Number,
                fontSize: Number,
                color: String,
                fontFamily: String,
            },
            regNoPosition: {
                x: Number,
                y: Number,
                fontSize: Number,
                color: String,
                fontFamily: String,
            },
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// Index for date sorting
EventSchema.index({ date: -1 });
EventSchema.index({ createdAt: -1 });
EventSchema.index({ isPublicDownload: 1 });

const Event: Model<IEvent> =
    mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;
