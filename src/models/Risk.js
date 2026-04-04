import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  status: { type: String, enum: ['Open', 'Monitoring', 'Mitigated', 'Closed'], required: true },
  note: { type: String, default: '' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now }
});

const riskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'projectId is required'] },
  title: { type: String, required: true },
  description: { type: String },
  probability: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  impact: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
  mitigationActions: { type: String, required: true },
  currentStatus: { type: String, enum: ['Open', 'Monitoring', 'Mitigated', 'Closed'], default: 'Open' },
  history: [historySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Risk', riskSchema);
