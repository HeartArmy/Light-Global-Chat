export interface Attachment {
  type: 'image' | 'file' | 'video';
  url: string;
  name: string;
  size: number;
}

export interface Reaction {
  emoji: string;
  userName: string;
}

export interface Message {
  _id: string;
  content: string;
  userName: string;
  userCountry: string;
  timestamp: Date;
  attachments: Attachment[];
  replyTo?: string | Message;
  reactions: Reaction[];
  edited: boolean;
  editedAt?: Date;
}

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}
