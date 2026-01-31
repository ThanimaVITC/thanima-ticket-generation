import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thanima-attendance';

async function seed() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Account = mongoose.model(
        'Account',
        new mongoose.Schema({
            name: String,
            email: { type: String, unique: true },
            passwordHash: String,
            createdAt: { type: Date, default: Date.now },
        })
    );

    const existingAdmin = await Account.findOne({ email: 'admin@thanima.com' });

    if (existingAdmin) {
        console.log('Admin account already exists');
    } else {
        const passwordHash = await bcrypt.hash('admin123', 10);
        await Account.create({
            name: 'Admin',
            email: 'admin@thanima.com',
            passwordHash,
        });
        console.log('Admin account created successfully');
        console.log('Email: admin@thanima.com');
        console.log('Password: admin123');
    }

    await mongoose.disconnect();
    console.log('Done');
}

seed().catch(console.error);
