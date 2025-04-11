import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Pending', 'Completed', 'Rejected'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Referral', referralSchema);
