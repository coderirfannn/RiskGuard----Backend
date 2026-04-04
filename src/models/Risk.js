import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now }
});

const riskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  probability: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  impact: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
  mitigationPlan: { type: String, required: true },
  status: { type: String, enum: ['Identified', 'Mitigating', 'Resolved'], default: 'Identified' },
  history: [historySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Risk', riskSchema);
