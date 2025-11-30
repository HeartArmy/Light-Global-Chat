import mongoose, { Schema, Model } from 'mongoose';

const LogSchema = new Schema({
  level: {
    type: String,
    enum: ['error', 'warn', 'info', 'debug'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  meta: {
    type: Schema.Types.Mixed,
    default: {},
  },
  route: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  userId: {
    type: String,
    default: null,
  },
  sessionId: {
    type: String,
    default: null,
  },
}, {
  timestamps: false,
});

// Index for efficient querying by timestamp and level
LogSchema.index({ timestamp: -1 });
LogSchema.index({ level: 1, timestamp: -1 });

// Prevent model recompilation in development
const Log: Model<any> = mongoose.models.Log || mongoose.model<any>('Log', LogSchema);

export default Log;