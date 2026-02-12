import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuestion {
    _id: mongoose.Types.ObjectId;
    text: string;
    options: string[];
    correctOptionIndex: number;
    order: number;
    isActive: boolean;
}

export interface IQuiz extends Document {
    _id: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    title: string;
    leaderboardToken: string;
    isVisible: boolean;
    questions: IQuestion[];
    createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
    {
        text: {
            type: String,
            required: [true, 'Question text is required'],
            trim: true,
        },
        options: {
            type: [String],
            required: [true, 'Options are required'],
            validate: {
                validator: (v: string[]) => v.length === 4,
                message: 'Exactly 4 options are required',
            },
        },
        correctOptionIndex: {
            type: Number,
            required: [true, 'Correct option index is required'],
            min: 0,
            max: 3,
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
    },
    { _id: true }
);

const QuizSchema = new Schema<IQuiz>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        leaderboardToken: {
            type: String,
            unique: true,
            sparse: true,
        },
        isVisible: {
            type: Boolean,
            default: false,
        },
        questions: {
            type: [QuestionSchema],
            default: [],
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// Compound index covers both { eventId, isVisible } queries and { eventId } prefix queries
QuizSchema.index({ eventId: 1, isVisible: 1 });

const Quiz: Model<IQuiz> =
    mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', QuizSchema);

export default Quiz;
