import mongoose, { Document, Schema } from 'mongoose';

export interface IGemmieCooldown extends Document {
  ip: string;
  lastConsideredAt: Date;
}

const GemmieCooldownSchema: Schema = new Schema({
  ip: { type: String, required: true, index: true },
  lastConsideredAt: { type: Date, required: true, expires: '60s' } // TTL index: auto-remove after 60 seconds
});

// Create a unique index on ip to prevent duplicate entries for the same IP
GemmieCooldownSchema.index({ ip: 1 }, { unique: true });

const GemmieCooldown = mongoose.model<IGemmieCooldown>('GemmieCooldown', GemmieCooldownSchema);

export default GemmieCooldown;
