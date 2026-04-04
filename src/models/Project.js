import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Project title is required'], trim: true },
  description: { type: String, default: '', trim: true },
  owner: { type: mongoose.Schema.Types.Mixed },
  startDate: { type: Date },
  endDate: { type: Date }
}, { timestamps: true });

export default mongoose.model('Project', projectSchema);
