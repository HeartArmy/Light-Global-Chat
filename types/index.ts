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

export interface ResponseValidationResult {
  isValid: boolean;
  needsCleaning: boolean;
  cleanedResponse: string;
  reason: string;
}

export interface DeletedMessageByGemmie {
  _id: string;
  originalMessageId: string;
  content: string;
  userName: string;
  userCountry: string;
  timestamp: Date;
  deletedAt: Date;
  attachments: Attachment[];
  replyTo?: string | Message;
  reactions: Reaction[];
  edited: boolean;
  editedAt?: Date;
  deletionReason: 'repetition' | 'self-correction' | 'manual';
}

export interface EditedMessageByGemmie {
  _id: string;
  originalMessageId: string;
  originalContent: string;
  newContent: string;
  editReason: 'user-feedback' | 'self-correction' | 'tone-adjustment' | 'personality-showcase' | 'enhancement';
  userName: string;
  userCountry: string;
  timestamp: Date;
  editedAt: Date;
  attachments: Attachment[];
  replyTo?: string | Message;
  reactions: Reaction[];
  edited: boolean;
  editedAtOriginal?: Date;
  triggerMessage: string;
  aiPrompt: string;
}
