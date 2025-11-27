import mongoose, { Schema, Model } from 'mongoose';
import { Message as MessageType, EditedMessageByGemmie as EditedMessageByGemmieType } from '@/types';

const AttachmentSchema = new Schema({
  type: {
    type: String,
    enum: ['image', 'file', 'video'],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
}, { _id: false });

const ReactionSchema = new Schema({
  emoji: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
}, { _id: false });

const EditedMessageByGemmieSchema = new Schema({
  originalMessageId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Message',
  },
  originalContent: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  newContent: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  editReason: {
    type: String,
    enum: ['user-feedback', 'self-correction', 'tone-adjustment', 'personality-showcase', 'enhancement'],
    required: true,
  },
  userName: {
    type: String,
    required: true,
    maxlength: 30,
  },
  userCountry: {
    type: String,
    required: true,
    length: 2,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  editedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  attachments: {
    type: [AttachmentSchema],
    default: [],
  },
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  reactions: {
    type: [ReactionSchema],
    default: [],
  },
  edited: {
    type: Boolean,
    default: true,
  },
  editedAtOriginal: {
    type: Date,
    default: null,
  },
  triggerMessage: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  aiPrompt: {
    type: String,
    required: true,
    maxlength: 2000,
  },
}, {
  timestamps: false,
});

// Index for efficient querying by edit time
EditedMessageByGemmieSchema.index({ editedAt: -1 });

// Index for efficient querying by original message ID
EditedMessageByGemmieSchema.index({ originalMessageId: 1 });

// Index for efficient querying by edit reason
EditedMessageByGemmieSchema.index({ editReason: 1 });

// Prevent model recompilation in development
const EditedMessageByGemmie: Model<EditedMessageByGemmieType> =
  mongoose.models.EditedMessageByGemmie ||
  mongoose.model<EditedMessageByGemmieType>(
    'EditedMessageByGemmie',
    EditedMessageByGemmieSchema
  );

export default EditedMessageByGemmie;