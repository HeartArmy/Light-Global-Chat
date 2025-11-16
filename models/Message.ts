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

const MessageSchema = new Schema({
  content: {
    type: String,
    required: false,
    default: '',
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
}, {
  timestamps: false,
});

// Index for efficient querying by timestamp
MessageSchema.index({ timestamp: -1 });

// Prevent model recompilation in development
const Message: Model<MessageType> = mongoose.models.Message || mongoose.model<MessageType>('Message', MessageSchema);

export default Message;
