import mongoose from 'mongoose';

const TopicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, trim: true, maxlength: 80 },
    strength: { type: Number, required: true, min: 0.0, max: 1.0 },
    lastMentionedAt: { type: Date, required: true },
  },
  { _id: false }
);

const SelfFactSchema = new mongoose.Schema(
  {
    fact: { type: String, required: true, trim: true, maxlength: 120 },
    strength: { type: Number, required: true, min: 0.0, max: 1.0 },
    lastMentionedAt: { type: Date, required: true },
  },
  { _id: false }
);

const GemmieMemorySchema = new mongoose.Schema({
  // Examples:
  // - `${userNameLower}:${userCountry}` for per-user topics
  // - `gemmie:self` for Gemmie self-facts
  key: { type: String, required: true, unique: true, index: true, maxlength: 120 },
  userCountry: { type: String, maxlength: 4 },
  currentName: { type: String, maxlength: 40 },
  knownNames: { type: [String], default: [] },
  lastSeenAt: { type: Date, required: true, default: Date.now },

  topics: { type: [TopicSchema], default: [] },
  selfFacts: { type: [SelfFactSchema], default: [] },
});

const GemmieMemory = mongoose.models.GemmieMemory || mongoose.model('GemmieMemory', GemmieMemorySchema);
export default GemmieMemory;

