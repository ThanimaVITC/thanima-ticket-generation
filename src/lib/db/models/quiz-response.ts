import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuizResponse extends Document {
    _id: mongoose.Types.ObjectId;
    quizId: mongoose.Types.ObjectId;
    questionId: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    regNo: string;
    name: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
    timeTakenMs: number;
    points: number;
    createdAt: Date;
}

const QuizResponseSchema = new Schema<IQuizResponse>(
    {
        quizId: {
            type: Schema.Types.ObjectId,
            ref: 'Quiz',
            required: [true, 'Quiz ID is required'],
        },
        questionId: {
            type: Schema.Types.ObjectId,
            required: [true, 'Question ID is required'],
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        regNo: {
            type: String,
            required: [true, 'Registration number is required'],
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        selectedOptionIndex: {
            type: Number,
            required: [true, 'Selected option is required'],
            min: 0,
            max: 3,
        },
        isCorrect: {
            type: Boolean,
            required: true,
        },
        timeTakenMs: {
            type: Number,
            required: [true, 'Time taken is required'],
            min: 0,
        },
        points: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
);

// Unique index to prevent duplicate answers
QuizResponseSchema.index({ quizId: 1, questionId: 1, regNo: 1 }, { unique: true });

// Indexes for leaderboard queries
QuizResponseSchema.index({ quizId: 1, regNo: 1 });
QuizResponseSchema.index({ eventId: 1, regNo: 1 });
QuizResponseSchema.index({ points: -1 });

const QuizResponse: Model<IQuizResponse> =
    mongoose.models.QuizResponse ||
    mongoose.model<IQuizResponse>('QuizResponse', QuizResponseSchema);

export default QuizResponse;
