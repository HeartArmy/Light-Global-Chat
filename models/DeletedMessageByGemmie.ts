import mongoose, { Schema, Model } from 'mongoose';
import { Message as MessageType } from '@/types';

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

const DeletedMessageByGemmieSchema = new Schema({
  originalMessageId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Message',
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
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
  deletedAt: {
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
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deletionReason: {
    type: String,
    enum: ['repetition', 'self-correction', 'manual'],
    default: 'repetition',
  },
}, {
  timestamps: false,
});

// Index for efficient querying by deletion time
DeletedMessageByGemmieSchema.index({ deletedAt: -1 });

// Index for efficient querying by original message ID
DeletedMessageByGemmieSchema.index({ originalMessageId: 1 });

// Prevent model recompilation in development
const DeletedMessageByGemmie: Model<any> =
  mongoose.models.DeletedMessageByGemmie ||
  mongoose.model<any>(
    'DeletedMessageByGemmie',
    DeletedMessageByGemmieSchema
  );

export default DeletedMessageByGemmie;