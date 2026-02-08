import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Load .env.local file (Next.js convention)
config({ path: resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const USERNAME_DEF = process.env.USERNAME_DEF;
const PASSWORD_DEF = process.env.PASSWORD_DEF;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is not defined.');
    console.error('Please ensure .env.local file exists with MONGODB_URI set.');
    process.exit(1);
}

// Define all schemas for collection creation
const AccountSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'quiz_admin'], default: 'admin' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    date: { type: Date, required: true },
    isPublicDownload: { type: Boolean, default: false },
    isActiveDisplay: { type: Boolean, default: false },
    ticketTemplate: {
        imagePath: String,
        qrPosition: { x: Number, y: Number, width: Number, height: Number },
        namePosition: { x: Number, y: Number, fontSize: Number, color: String, fontFamily: String },
        regNoPosition: { x: Number, y: Number, fontSize: Number, color: String, fontFamily: String },
    },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const EventRegistrationSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    regNo: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    downloadCount: { type: Number, default: 0 },
    qrPayload: { type: String, default: null },
    rateLimitWindowStart: { type: Date, default: Date.now },
    rateLimitCount: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const AttendanceSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    markedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['web', 'mobile'], required: true },
}, { timestamps: false });

const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
}, { _id: true });

const QuizSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    title: { type: String, required: true, trim: true },
    leaderboardToken: { type: String, unique: true, sparse: true },
    isVisible: { type: Boolean, default: false },
    questions: { type: [QuestionSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const QuizResponseSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    regNo: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    selectedOptionIndex: { type: Number, required: true, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true },
    timeTakenMs: { type: Number, required: true, min: 0 },
    points: { type: Number, required: true, default: 0 },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

// Add indexes
EventRegistrationSchema.index({ eventId: 1, email: 1 }, { unique: true });
EventRegistrationSchema.index({ eventId: 1, regNo: 1 }, { unique: true });
EventRegistrationSchema.index({ eventId: 1 });
EventRegistrationSchema.index({ email: 1 });
EventRegistrationSchema.index({ regNo: 1 });
EventRegistrationSchema.index({ phone: 1 });

AttendanceSchema.index({ eventId: 1, email: 1 }, { unique: true });
AttendanceSchema.index({ eventId: 1 });
AttendanceSchema.index({ email: 1 });

EventSchema.index({ date: -1 });
EventSchema.index({ createdAt: -1 });
EventSchema.index({ isPublicDownload: 1 });

QuizSchema.index({ eventId: 1 });
QuizSchema.index({ isVisible: 1 });

QuizResponseSchema.index({ quizId: 1, questionId: 1, regNo: 1 }, { unique: true });
QuizResponseSchema.index({ quizId: 1, regNo: 1 });
QuizResponseSchema.index({ eventId: 1, regNo: 1 });
QuizResponseSchema.index({ points: -1 });

async function seed() {
    console.log('Connecting to MongoDB...');
    console.log(`URI: ${MONGODB_URI?.substring(0, 30)}...`);

    try {
        await mongoose.connect(MONGODB_URI!);
        console.log('✓ Connected to MongoDB');
    } catch (error) {
        console.error('✗ Failed to connect to MongoDB:', error);
        process.exit(1);
    }

    // Register all models to create collections
    console.log('\nCreating collections and indexes...');

    const Account = mongoose.models.Account || mongoose.model('Account', AccountSchema);
    const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
    const EventRegistration = mongoose.models.EventRegistration || mongoose.model('EventRegistration', EventRegistrationSchema);
    const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
    const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
    const QuizResponse = mongoose.models.QuizResponse || mongoose.model('QuizResponse', QuizResponseSchema);

    // Ensure indexes are created
    await Account.createIndexes();
    console.log('✓ Account collection ready');

    await Event.createIndexes();
    console.log('✓ Event collection ready');

    await EventRegistration.createIndexes();
    console.log('✓ EventRegistration collection ready');

    await Attendance.createIndexes();
    console.log('✓ Attendance collection ready');

    await Quiz.createIndexes();
    console.log('✓ Quiz collection ready');

    await QuizResponse.createIndexes();
    console.log('✓ QuizResponse collection ready');

    // Seed admin account
    console.log('\nSeeding admin account...');
    const existingAdmin = await Account.findOne({ email: USERNAME_DEF });

    if (existingAdmin) {
        console.log('→ Admin account already exists');
    } else {
        const passwordHash = await bcrypt.hash(PASSWORD_DEF!, 10);
        await Account.create({
            name: 'Admin',
            email: USERNAME_DEF,
            passwordHash,
            role: 'admin',
        });
        console.log('✓ Admin account created successfully');
        console.log('  Email: ' + USERNAME_DEF!);
        console.log('  Password: ' + PASSWORD_DEF!);
    }

    await mongoose.disconnect();
    console.log('\n✓ Done! Database seeded successfully.');
}

seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
