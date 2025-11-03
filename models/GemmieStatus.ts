import mongoose from 'mongoose';

const GemmieStatusSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: String,
    default: 'arham',
  },
});

export default mongoose.models.GemmieStatus || mongoose.model('GemmieStatus', GemmieStatusSchema);