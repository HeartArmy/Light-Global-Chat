import mongoose, { Schema, Model } from 'mongoose';

interface INotification {
  type: 'email' | 'telegram';
  lastSentAt: Date;
}

const NotificationSchema = new Schema({
  type: {
    type: String,
    enum: ['email', 'telegram'],
    required: true,
    unique: true,
  },
  lastSentAt: {
    type: Date,
    required: true,
  },
});

const Notification: Model<INotification> = 
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
